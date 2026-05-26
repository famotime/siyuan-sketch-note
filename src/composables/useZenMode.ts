import { ref, computed, onUnmounted } from "vue";
import { clampZenTogglePosition, createZenToggleState } from "@/editor/zenMode";

export function useZenMode() {
  const isZenMode = ref(false);
  const zenTogglePos = ref({ left: 24, top: 132 });
  const zenToggleState = computed(() => createZenToggleState(isZenMode.value));
  let zenDragOffset = { x: 0, y: 0 };
  let zenToggleDragging = false;
  let zenToggleMoved = false;

  onUnmounted(() => {
    removeZenToggleDragListeners();
  });

  function enterZenMode() {
    isZenMode.value = true;
    zenTogglePos.value = clampZenTogglePosition(zenTogglePos.value, getZenToggleBounds());
  }

  function exitZenMode() {
    isZenMode.value = false;
  }

  function onZenToggleClick() {
    if (zenToggleMoved) {
      zenToggleMoved = false;
      return;
    }
    exitZenMode();
  }

  function onZenToggleDragStart(e: MouseEvent | TouchEvent) {
    zenToggleDragging = true;
    zenToggleMoved = false;
    const point = getClientPoint(e);
    zenDragOffset = {
      x: point.x - zenTogglePos.value.left,
      y: point.y - zenTogglePos.value.top,
    };
    window.addEventListener("mousemove", onZenToggleDragging);
    window.addEventListener("touchmove", onZenToggleDragging, { passive: false });
    window.addEventListener("mouseup", onZenToggleDragEnd);
    window.addEventListener("touchend", onZenToggleDragEnd, { passive: true });
  }

  function onZenToggleDragging(e: MouseEvent | TouchEvent) {
    if (!zenToggleDragging) return;
    if (e instanceof TouchEvent) {
      e.preventDefault();
    }
    const point = getClientPoint(e);
    const nextPos = clampZenTogglePosition(
      {
        left: point.x - zenDragOffset.x,
        top: point.y - zenDragOffset.y,
      },
      getZenToggleBounds(),
    );
    if (Math.abs(nextPos.left - zenTogglePos.value.left) > 2 || Math.abs(nextPos.top - zenTogglePos.value.top) > 2) {
      zenToggleMoved = true;
    }
    zenTogglePos.value = nextPos;
  }

  function onZenToggleDragEnd() {
    zenToggleDragging = false;
    removeZenToggleDragListeners();
  }

  function removeZenToggleDragListeners() {
    window.removeEventListener("mousemove", onZenToggleDragging);
    window.removeEventListener("touchmove", onZenToggleDragging);
    window.removeEventListener("mouseup", onZenToggleDragEnd);
    window.removeEventListener("touchend", onZenToggleDragEnd);
  }

  function getClientPoint(e: MouseEvent | TouchEvent) {
    if (e instanceof MouseEvent) {
      return { x: e.clientX, y: e.clientY };
    }
    const touch = e.touches[0] ?? e.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  function getZenToggleBounds() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      size: 52,
      margin: 12,
    };
  }

  return {
    isZenMode,
    zenTogglePos,
    zenToggleState,
    enterZenMode,
    exitZenMode,
    onZenToggleClick,
    onZenToggleDragStart,
  };
}
