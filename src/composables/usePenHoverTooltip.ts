import type { Ref } from "vue";
import { onMounted, onUnmounted, getCurrentInstance } from "vue";

export interface TooltipPosition {
  top: number;
  left: number;
}

export interface PositionOptions {
  targetRect: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number };
  tooltipRect: { width: number; height: number };
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  padding?: number;
}

/**
 * 判断事件是否属于支持悬停的指针设备（鼠标 或 悬浮未接触屏幕的手写笔）
 */
export function isHoverablePointerEvent(e: { pointerType?: string; buttons?: number }): boolean {
  if (e.pointerType === "mouse") {
    return true;
  }
  if (e.pointerType === "pen" && (e.buttons === 0 || e.buttons === undefined)) {
    return true;
  }
  return false;
}

/**
 * 从元素或其祖先节点中查找并提取提示文本
 */
export function extractTooltipInfo(
  target: EventTarget | null,
  rootElement?: HTMLElement | null,
): { element: HTMLElement; text: string } | null {
  if (!target || !(target instanceof HTMLElement)) {
    return null;
  }

  let current: HTMLElement | null = target;
  while (current && current !== rootElement && current !== document.body) {
    // 优先读取自定义 data-tooltip，其次是 title 或已备份的 original-title，最后是 aria-label
    const dataTooltip = current.getAttribute("data-tooltip");
    if (dataTooltip && dataTooltip.trim()) {
      return { element: current, text: dataTooltip.trim() };
    }

    const title = current.getAttribute("title") || current.getAttribute("data-sketch-orig-title");
    if (title && title.trim()) {
      return { element: current, text: title.trim() };
    }

    const ariaLabel = current.getAttribute("aria-label");
    // 仅对具有交互意图的元素提取 aria-label，防止无意义标签冒泡
    if (
      ariaLabel
      && ariaLabel.trim()
      && (current.tagName === "BUTTON" || current.tagName === "A" || current.getAttribute("role") === "button")
    ) {
      return { element: current, text: ariaLabel.trim() };
    }

    current = current.parentElement;
  }

  return null;
}

/**
 * 计算 Tooltip 的最佳视口绝对坐标，自带防屏幕溢出
 */
export function calculateTooltipPosition(options: PositionOptions): TooltipPosition {
  const {
    targetRect,
    tooltipRect,
    viewportWidth,
    viewportHeight,
    gap = 6,
    padding = 8,
  } = options;

  const tipW = tooltipRect.width || 80;
  const tipH = tooltipRect.height || 28;

  // 水平居中并做视口边界限制
  let left = targetRect.left + (targetRect.width - tipW) / 2;
  left = Math.max(padding, Math.min(viewportWidth - tipW - padding, left));

  // 垂直位置策略：优先放置在下方，若下方空间不足则放置在上方
  let top = targetRect.bottom + gap;
  if (top + tipH > viewportHeight - padding) {
    // 下方溢出，尝试放置在上方
    const topAlternative = targetRect.top - tipH - gap;
    if (topAlternative >= padding) {
      top = topAlternative;
    } else {
      // 上下都局促时，限制在视口底部内
      top = Math.max(padding, viewportHeight - tipH - padding);
    }
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
  };
}

let sharedTooltipEl: HTMLDivElement | null = null;

export function getOrCreateSharedTooltipElement(): HTMLDivElement {
  if (sharedTooltipEl && document.body.contains(sharedTooltipEl)) {
    return sharedTooltipEl;
  }
  const el = document.createElement("div");
  el.className = "sketch-pen-tooltip";
  el.setAttribute("role", "tooltip");
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
  document.body.appendChild(el);
  sharedTooltipEl = el;
  return el;
}

/**
 * 销毁共享的 Tooltip DOM 节点（主要用于测试清理）
 */
export function resetSharedTooltipElementForTest() {
  if (sharedTooltipEl && document.body.contains(sharedTooltipEl)) {
    document.body.removeChild(sharedTooltipEl);
  }
  sharedTooltipEl = null;
}

export interface PenHoverTooltipOptions {
  delayMs?: number;
}

/**
 * 为指定 DOM 容器绑定手写笔与鼠标悬浮 Tooltip 监听器
 */
export function createPenHoverTooltipManager(
  getRoot: () => HTMLElement | null | undefined,
  options: PenHoverTooltipOptions = {},
) {
  const delayMs = options.delayMs ?? 200;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let currentTargetEl: HTMLElement | null = null;

  const hide = () => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (sharedTooltipEl) {
      sharedTooltipEl.style.display = "none";
      sharedTooltipEl.classList.remove("sketch-pen-tooltip--visible");
    }
    if (currentTargetEl) {
      // 还原之前备份的原生 title，避免 DOM 属性永久丢失
      const origTitle = currentTargetEl.getAttribute("data-sketch-orig-title");
      if (origTitle !== null) {
        currentTargetEl.setAttribute("title", origTitle);
        currentTargetEl.removeAttribute("data-sketch-orig-title");
      }
      currentTargetEl = null;
    }
  };

  const onPointerOver = (e: PointerEvent) => {
    if (!isHoverablePointerEvent(e)) {
      return;
    }

    const root = getRoot();
    const info = extractTooltipInfo(e.target, root);
    if (!info) {
      // 移动到了无提示的空白区域，直接隐藏现有 tooltip
      if (currentTargetEl && !currentTargetEl.contains(e.target as Node)) {
        hide();
      }
      return;
    }

    const { element, text } = info;
    if (element === currentTargetEl) {
      // 仍在当前元素内移动，保持展示
      return;
    }

    // 切换到了新的提示元素，先清理上一元素
    hide();
    currentTargetEl = element;

    // 将原生 title 移至备份属性，防止浏览器自带黑白原生 Tooltip 冲突重叠
    const nativeTitle = element.getAttribute("title");
    if (nativeTitle) {
      element.setAttribute("data-sketch-orig-title", nativeTitle);
      element.removeAttribute("title");
    }

    showTimer = setTimeout(() => {
      if (!currentTargetEl || !document.body.contains(currentTargetEl)) {
        return;
      }
      const tip = getOrCreateSharedTooltipElement();
      tip.textContent = text;
      tip.style.display = "block";

      const targetRect = currentTargetEl.getBoundingClientRect();
      const tooltipRect = tip.getBoundingClientRect();
      const pos = calculateTooltipPosition({
        targetRect,
        tooltipRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });

      tip.style.top = `${pos.top}px`;
      tip.style.left = `${pos.left}px`;
      tip.classList.add("sketch-pen-tooltip--visible");
    }, delayMs);
  };

  const onPointerOut = (e: PointerEvent) => {
    if (currentTargetEl) {
      // 检查相关目标是否脱离了当前元素
      const related = e.relatedTarget as Node | null;
      if (!related || !currentTargetEl.contains(related)) {
        hide();
      }
    }
  };

  const onPointerDown = () => {
    // 无论是手写笔落笔画线还是鼠标/触控点击，立即隐藏提示
    hide();
  };

  const onScrollOrWheel = () => {
    hide();
  };

  const attach = () => {
    const root = getRoot();
    if (root) {
      root.addEventListener("pointerover", onPointerOver as EventListener);
      root.addEventListener("pointerout", onPointerOut as EventListener);
      root.addEventListener("pointerdown", onPointerDown as EventListener, { capture: true });
      root.addEventListener("pointercancel", onPointerDown as EventListener, { capture: true });
      root.addEventListener("scroll", onScrollOrWheel, { capture: true, passive: true });
    }
    window.addEventListener("scroll", onScrollOrWheel, { capture: true, passive: true });
  };

  const detach = () => {
    hide();
    const root = getRoot();
    if (root) {
      root.removeEventListener("pointerover", onPointerOver as EventListener);
      root.removeEventListener("pointerout", onPointerOut as EventListener);
      root.removeEventListener("pointerdown", onPointerDown as EventListener, { capture: true });
      root.removeEventListener("pointercancel", onPointerDown as EventListener, { capture: true });
      root.removeEventListener("scroll", onScrollOrWheel, { capture: true });
    }
    window.removeEventListener("scroll", onScrollOrWheel, { capture: true });
  };

  return {
    attach,
    detach,
    hide,
  };
}

/**
 * 触控笔与鼠标悬浮提示通用 Composable
 *
 * 适用于手机/平板（S-Pen/Apple Pencil 悬浮）及桌面端鼠标操作：
 * - 捕获 pointerType === 'pen'（buttons === 0）与 pointerType === 'mouse'
 * - 忽略普通手指触控（pointerType === 'touch'）
 * - 落笔（pointerdown）立即隐藏，避免书写遮挡
 */
export function usePenHoverTooltip(
  rootRef: Ref<HTMLElement | null | undefined>,
  options: PenHoverTooltipOptions = {},
) {
  const manager = createPenHoverTooltipManager(() => rootRef.value, options);

  if (getCurrentInstance()) {
    onMounted(() => {
      manager.attach();
    });

    onUnmounted(() => {
      manager.detach();
    });
  }

  return {
    attach: manager.attach,
    detach: manager.detach,
    hide: manager.hide,
  };
}
