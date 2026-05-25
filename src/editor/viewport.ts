export interface ViewportMetrics {
  left: number;
  top: number;
  scale: number;
}

export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export function createCanvasPointConverter(
  getMetrics: () => ViewportMetrics,
): (point: ClientPoint) => CanvasPoint {
  return (point) => {
    const metrics = getMetrics();
    const scale = metrics.scale || 1;
    return {
      x: (point.clientX - metrics.left) / scale,
      y: (point.clientY - metrics.top) / scale,
    };
  };
}
