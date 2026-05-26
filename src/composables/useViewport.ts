import { ref, onUnmounted } from "vue";
import type { Ref } from "vue";

export function useViewport(ctx: {
  containerRef: Ref<HTMLDivElement | undefined>;
}) {
  const viewportScale = ref(1);
  const viewportPanX = ref(0);
  const viewportPanY = ref(0);
  const showIndicator = ref(false);
  const zoomLocked = ref(loadZoomLock());
  let indicatorHideTimer: ReturnType<typeof setTimeout> | null = null;

  // Two-finger gesture tracking
  const pointers = new Map<number, { x: number; y: number; type: string }>();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchStartMidX = 0;
  let pinchStartMidY = 0;
  let pinchStartPanX = 0;
  let pinchStartPanY = 0;
  let twoFingerActive = false;
  let postPinchGuard = 0;
  let pinchPrevMidX = 0;
  let pinchPrevMidY = 0;

  // Right-click pan tracking
  let rightPanActive = false;
  let rightPanLastX = 0;
  let rightPanLastY = 0;

  const ZOOM_LOCK_KEY = "sketch-note-zoom-lock";

  function loadZoomLock(): boolean {
    try { return localStorage.getItem(ZOOM_LOCK_KEY) === "true"; }
    catch { return false; }
  }

  function saveZoomLock(locked: boolean) {
    try { localStorage.setItem(ZOOM_LOCK_KEY, String(locked)); }
    catch { /* ignore */ }
  }

  function showZoomIndicator() {
    showIndicator.value = true;
    if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }
  }

  function scheduleHideZoomIndicator() {
    if (zoomLocked.value) return;
    if (indicatorHideTimer) clearTimeout(indicatorHideTimer);
    indicatorHideTimer = setTimeout(() => { showIndicator.value = false; }, 1500);
  }

  function toggleZoomLock() {
    zoomLocked.value = !zoomLocked.value;
    saveZoomLock(zoomLocked.value);
    if (zoomLocked.value) {
      showZoomIndicator();
      if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }
    } else {
      scheduleHideZoomIndicator();
    }
  }

  function resetViewport() {
    viewportScale.value = 1;
    viewportPanX.value = 0;
    viewportPanY.value = 0;
  }

  function handleWheelZoom(e: WheelEvent) {
    if (zoomLocked.value) return;
    const rect = ctx.containerRef.value!.getBoundingClientRect();
    const cursorScreenX = e.clientX - rect.left;
    const cursorScreenY = e.clientY - rect.top;
    const canvasX = cursorScreenX / viewportScale.value;
    const canvasY = cursorScreenY / viewportScale.value;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(5, Math.max(1, viewportScale.value * zoomFactor));
    viewportScale.value = newScale;
    viewportPanX.value = cursorScreenX - canvasX * newScale;
    viewportPanY.value = cursorScreenY - canvasY * newScale;
    showZoomIndicator();
    scheduleHideZoomIndicator();
  }

  function handlePointerDown(e: PointerEvent): "two-finger" | "right-pan" | null {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (pointers.size >= 2 && !twoFingerActive) {
      return "two-finger";
    }
    if (twoFingerActive) return "two-finger";

    if (e.button === 2) {
      rightPanActive = true;
      rightPanLastX = e.clientX;
      rightPanLastY = e.clientY;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return "right-pan";
    }

    return null;
  }

  function startTwoFingerGesture(stylusOnly: boolean): boolean {
    if (pointers.size < 2 || twoFingerActive) return false;
    if (stylusOnly) {
      const hasPen = Array.from(pointers.values()).some((p) => p.type === "pen");
      if (hasPen) return false;
    }
    twoFingerActive = true;
    const pts = Array.from(pointers.values());
    pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    pinchStartScale = viewportScale.value;
    pinchStartMidX = (pts[0].x + pts[1].x) / 2;
    pinchStartMidY = (pts[0].y + pts[1].y) / 2;
    pinchStartPanX = viewportPanX.value;
    pinchStartPanY = viewportPanY.value;
    pinchPrevMidX = pinchStartMidX;
    pinchPrevMidY = pinchStartMidY;
    return true;
  }

  function handlePointerMove(e: PointerEvent): "two-finger" | "right-pan" | null {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    }

    if (twoFingerActive && pointers.size >= 2) {
      const pts = Array.from(pointers.values());
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (zoomLocked.value) {
        viewportPanX.value += midX - pinchPrevMidX;
        viewportPanY.value += midY - pinchPrevMidY;
      } else {
        const rawScale = pinchStartScale * (newDist / pinchStartDist);
        const newScale = Math.min(5, Math.max(1, rawScale));
        viewportScale.value = newScale;
        viewportPanX.value = midX - (pinchStartMidX - pinchStartPanX) * (newScale / pinchStartScale);
        viewportPanY.value = midY - (pinchStartMidY - pinchStartPanY) * (newScale / pinchStartScale);
      }
      pinchPrevMidX = midX;
      pinchPrevMidY = midY;
      showZoomIndicator();
      return "two-finger";
    }
    if (twoFingerActive) return "two-finger";

    if (rightPanActive) {
      viewportPanX.value += e.clientX - rightPanLastX;
      viewportPanY.value += e.clientY - rightPanLastY;
      rightPanLastX = e.clientX;
      rightPanLastY = e.clientY;
      showZoomIndicator();
      return "right-pan";
    }

    return null;
  }

  function handlePointerUp(e: PointerEvent): "two-finger" | "right-pan" | null {
    pointers.delete(e.pointerId);

    if (twoFingerActive) {
      if (pointers.size < 2) {
        twoFingerActive = false;
        postPinchGuard = Date.now() + 300;
        scheduleHideZoomIndicator();
      }
      if (pointers.size === 0) {
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      }
      return "two-finger";
    }
    if (Date.now() < postPinchGuard) return "two-finger";

    if (rightPanActive) {
      rightPanActive = false;
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      scheduleHideZoomIndicator();
      return "right-pan";
    }

    return null;
  }

  function isPostPinchGuard(): boolean {
    return Date.now() < postPinchGuard;
  }

  onUnmounted(() => {
    if (indicatorHideTimer) clearTimeout(indicatorHideTimer);
  });

  return {
    viewportScale,
    viewportPanX,
    viewportPanY,
    showIndicator,
    zoomLocked,
    toggleZoomLock,
    resetViewport,
    handleWheelZoom,
    handlePointerDown,
    startTwoFingerGesture,
    handlePointerMove,
    handlePointerUp,
    isPostPinchGuard,
    showZoomIndicator,
    scheduleHideZoomIndicator,
  };
}
