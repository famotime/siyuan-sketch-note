import {
  Plugin,
  fetchSyncPost,
  getFrontend,
  getActiveEditor,
} from "siyuan";
import "@/index.scss";
import { init, destroy } from "./main";
import { renderSketchBlocks, rerenderSketchBlock } from "./widget/sketchRenderer";
import { openSketchEditor, setI18n } from "./App.vue";
import { storageKey } from "./storage";

export default class SketchNotePlugin extends Plugin {
  public isMobile = false;
  public isBrowser = false;
  public isElectron = false;
  private lastProtyleContainer: HTMLElement | null = null;
  private onSketchSaved: ((e: CustomEvent) => void) | null = null;

  async onload() {
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.isBrowser = frontEnd === "browser-desktop" || frontEnd === "browser-mobile";
    this.isElectron = frontEnd === "desktop";

    // Initialize i18n
    setI18n(this.i18n ?? {});

    // Initialize Vue app
    init(this);

    // Register event listeners for block rendering
    this.eventBus.on("loaded-protyle-static", this.onProtyleLoaded);
    this.eventBus.on("loaded-protyle-dynamic", this.onProtyleLoaded);

    // Re-render sketch block thumbnail after saving
    this.onSketchSaved = (e: CustomEvent) => {
      const { blockId } = e.detail;
      if (!blockId || !this.lastProtyleContainer) return;
      rerenderSketchBlock(
        blockId,
        this.lastProtyleContainer,
        (key) => this.loadData(key),
        (id) => openSketchEditor(id)
      );
    };
    window.addEventListener("sketch-note-saved", this.onSketchSaved as EventListener);

    // Add top bar button
    this.addTopBar({
      icon: "iconPencil",
      title: this.i18n?.insertSketch ?? "Insert Sketch Block",
      callback: () => this.insertSketchBlock(),
    });

    // Register command
    this.addCommand({
      langKey: "insertSketch",
      hotkey: "Ctrl+Shift+S",
      callback: () => this.insertSketchBlock(),
    });

    // Expose openEditor for renderer callbacks
    window.sySketchNote = {
      openEditor: (blockId: string) => openSketchEditor(blockId),
    };
  }

  onunload() {
    this.eventBus.off("loaded-protyle-static", this.onProtyleLoaded);
    this.eventBus.off("loaded-protyle-dynamic", this.onProtyleLoaded);
    if (this.onSketchSaved) {
      window.removeEventListener("sketch-note-saved", this.onSketchSaved as EventListener);
      this.onSketchSaved = null;
    }
    this.lastProtyleContainer = null;
    destroy();
    delete window.sySketchNote;
  }

  private onProtyleLoaded = (event: CustomEvent) => {
    const { protyle } = event.detail;
    if (!protyle?.wysiwyg?.element) return;
    const container = protyle.wysiwyg.element;
    this.lastProtyleContainer = container;
    renderSketchBlocks(container, (key) => this.loadData(key), (blockId) => {
      openSketchEditor(blockId);
    });
  };

  private getCurrentDocId(): string | null {
    const editor = getActiveEditor();
    return editor?.protyle?.block?.rootID || null;
  }

  private async insertSketchBlock() {
    const docId = this.getCurrentDocId();
    if (!docId) {
      console.error("[Sketch Note] 无法获取当前文档 ID，请先打开一个文档");
      return;
    }

    const blockId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const data = "```sketch-note\n" + blockId + "\n```";

    try {
      const result = await fetchSyncPost("/api/block/appendBlock", {
        dataType: "markdown",
        data,
        parentID: docId,
      });
      if (result.code === 0) {
        await this.saveData(storageKey(blockId), {
          version: 1,
          template: "blank",
          canvasWidth: 800,
          canvasHeight: 1200,
          strokes: [],
          thumbnail: null,
        });
        await openSketchEditor(blockId);
      } else {
        console.error("[Sketch Note] 插入块失败:", result.msg);
      }
    } catch (e) {
      console.error("[Sketch Note] Failed to insert block:", e);
    }
  }
}
