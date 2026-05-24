export interface Point {
  x: number;
  y: number;
}

export interface RulerState {
  x: number;
  y: number;
  angle: number;
  length: number;
}

export function createRulerState(input: RulerState): RulerState {
  return {
    ...input,
    angle: snapRulerAngle(input.angle),
  };
}

export function snapRulerAngle(angle: number, increment = 45): number {
  const snapped = Math.round(angle / increment) * increment;
  return ((snapped % 360) + 360) % 360;
}

export function moveRuler(ruler: RulerState, dx: number, dy: number): RulerState {
  return {
    ...ruler,
    x: ruler.x + dx,
    y: ruler.y + dy,
  };
}

export function rotateRuler(ruler: RulerState, angle: number): RulerState {
  return {
    ...ruler,
    angle: snapRulerAngle(angle),
  };
}

export function projectPointToRuler(point: Point, ruler: RulerState): Point {
  const radians = (ruler.angle * Math.PI) / 180;
  const direction = {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
  const relative = {
    x: point.x - ruler.x,
    y: point.y - ruler.y,
  };
  const distanceAlongRuler = relative.x * direction.x + relative.y * direction.y;

  return {
    x: ruler.x + direction.x * distanceAlongRuler,
    y: ruler.y + direction.y * distanceAlongRuler,
  };
}
