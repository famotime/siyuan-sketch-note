export interface RawInputPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timeStamp: number;
  isPredicted?: boolean;
}

export interface ExtractedPointerData {
  realPoints: RawInputPoint[];
  predictedPoints: RawInputPoint[];
}

/**
 * 从原生 PointerEvent 中提取所有合并高频真实点 (Coalesced) 与预测点 (Predicted)
 *
 * @param e 原生 PointerEvent
 * @param canvasToLogicalCoord 屏幕/视口像素转逻辑画布坐标函数
 * @param enablePressure 是否启用压感
 */
export function extractPointerPoints(
  e: PointerEvent,
  canvasToLogicalCoord: (clientX: number, clientY: number) => { x: number; y: number },
  enablePressure: boolean = true,
): ExtractedPointerData {
  const realPoints: RawInputPoint[] = [];
  const predictedPoints: RawInputPoint[] = [];

  // 1. 提取硬件高频采样真实合并事件 (Coalesced Events)
  const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
  const sourceEvents = coalesced && coalesced.length > 0 ? coalesced : [e];

  for (const evt of sourceEvents) {
    const pt = canvasToLogicalCoord(evt.clientX, evt.clientY);
    const rawPressure = enablePressure
      ? (typeof evt.pressure === "number" && evt.pressure > 0 ? evt.pressure : 0.5)
      : 0.5;

    realPoints.push({
      x: pt.x,
      y: pt.y,
      pressure: rawPressure,
      tiltX: evt.tiltX,
      tiltY: evt.tiltY,
      timeStamp: evt.timeStamp || performance.now(),
      isPredicted: false,
    });
  }

  // 2. 提取未来预测点 (Predicted Events) 用于前瞻渲染消除视觉延迟
  if (typeof e.getPredictedEvents === "function") {
    const predicted = e.getPredictedEvents();
    if (predicted && predicted.length > 0) {
      for (const evt of predicted) {
        const pt = canvasToLogicalCoord(evt.clientX, evt.clientY);
        const rawPressure = enablePressure
          ? (typeof evt.pressure === "number" && evt.pressure > 0 ? evt.pressure : 0.5)
          : 0.5;

        predictedPoints.push({
          x: pt.x,
          y: pt.y,
          pressure: rawPressure,
          tiltX: evt.tiltX,
          tiltY: evt.tiltY,
          timeStamp: evt.timeStamp || performance.now(),
          isPredicted: true,
        });
      }
    }
  }

  return { realPoints, predictedPoints };
}
