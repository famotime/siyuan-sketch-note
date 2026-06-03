import { ref } from "vue";
import type { Ref } from "vue";
import type { ToolPresetCollection } from "@/types/sketch";
import type { EngineState } from "@/engine/canvasEngine";
import { createTextElement, updateTextElement } from "@/elements/text";
import { pushHistorySnapshot, fullRedrawStrokeCanvas } from "@/engine/canvasEngine";
import { createInsertElementPosition } from "@/editor/insertPosition";
import type { SketchElement } from "@/elements/model";

export function useTextEditing(ctx: {
  state: () => EngineState;
  getCanvas: () => HTMLCanvasElement;
  toolPresets: Ref<ToolPresetCollection>;
  updateUndoRedoState: () => void;
  emit: (e: "stroke") => void;
  recorder?: { record: (event: any) => void };
}) {
  const textEditor = ref({
    show: false,
    x: 0,
    y: 0,
    width: 150,
    height: 28,
    color: "#000000",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 20,
    val: "",
    elementId: null as string | null,
  });
  const textEditorInputRef = ref<HTMLTextAreaElement>();

  function startNewTextEditing(x: number, y: number) {
    const textStyle = ctx.toolPresets.value.text ?? { color: "#000000", width: 20 };
    const fontSize = textStyle.width;
    textEditor.value = {
      show: true,
      x,
      y: y - fontSize / 2,
      width: 150,
      height: fontSize + 8,
      color: textStyle.color,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize,
      val: "",
      elementId: null,
    };
    setTimeout(() => {
      if (textEditorInputRef.value) textEditorInputRef.value.focus();
    }, 50);
  }

  function insertText(state: EngineState) {
    const textStyle = ctx.toolPresets.value.text ?? { color: "#000000", width: 20 };
    const fontSize = textStyle.width;
    const position = createInsertElementPosition({
      canvasWidth: state.canvasWidth,
      pageMode: state.pageMode,
      activePageId: state.activePageId,
      pages: state.pages,
      elementWidth: 220,
      topOffset: 120,
    });
    textEditor.value = {
      show: true,
      x: position.x,
      y: position.y,
      width: 150,
      height: fontSize + 8,
      color: textStyle.color,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize,
      val: "",
      elementId: null,
    };
    setTimeout(() => {
      if (textEditorInputRef.value) textEditorInputRef.value.focus();
    }, 50);
  }

  function startEditText(element: SketchElement & { type: "text" }) {
    textEditor.value = {
      show: true,
      x: element.bounds.x,
      y: element.bounds.y,
      width: element.bounds.width,
      height: element.bounds.height,
      color: element.style.color,
      fontFamily: element.style.fontFamily,
      fontSize: element.style.fontSize,
      val: element.text,
      elementId: element.id,
    };
    setTimeout(() => {
      if (textEditorInputRef.value) {
        textEditorInputRef.value.focus();
        textEditorInputRef.value.select();
      }
    }, 50);
  }

  function finishTextEditing() {
    if (!textEditor.value.show) return;
    const { elementId, val, x, y } = textEditor.value;
    textEditor.value.show = false;
    const state = ctx.state();

    if (!val.trim()) {
      if (elementId) {
        pushHistorySnapshot(state);
        state.elements = state.elements.filter((item) => item.id !== elementId);
        state.isDirty = true;
        fullRedrawStrokeCanvas(ctx.getCanvas(), state);
        ctx.updateUndoRedoState();
        ctx.emit("stroke");
      }
      return;
    }

    pushHistorySnapshot(state);

    let recordedElement: SketchElement | null = null;

    if (elementId) {
      state.elements = state.elements.map((item) => {
        if (item.id === elementId) {
          const updated = updateTextElement(item as any, { text: val });
          recordedElement = updated;
          return updated;
        }
        return item;
      });
    } else {
      const textStyle = ctx.toolPresets.value.text ?? { color: "#000000", width: 20 };
      const fontSize = textStyle.width;
      const color = textStyle.color;
      const lines = val.split("\n");
      const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
      const calculatedWidth = Math.max(150, longestLine * fontSize * 0.65);
      const calculatedHeight = lines.length * fontSize + 8;
      const element = createTextElement(`text-${Date.now()}`, {
        x,
        y,
        text: val,
        width: calculatedWidth,
        height: calculatedHeight,
        style: { fontSize, color, fontFamily: "Inter, system-ui, sans-serif" },
      });
      state.elements = [...state.elements, element];
      recordedElement = element;
    }

    state.isDirty = true;
    fullRedrawStrokeCanvas(ctx.getCanvas(), state);
    ctx.updateUndoRedoState();
    ctx.emit("stroke");

    // Record replay event
    if (ctx.recorder && recordedElement) {
      ctx.recorder.record({
        type: "text",
        id: `re-${Date.now()}`,
        timestamp: Date.now(),
        element: recordedElement,
      });
    }
  }

  function cancelTextEditing() {
    textEditor.value.show = false;
  }

  return {
    textEditor,
    textEditorInputRef,
    startNewTextEditing,
    insertText,
    startEditText,
    finishTextEditing,
    cancelTextEditing,
  };
}
