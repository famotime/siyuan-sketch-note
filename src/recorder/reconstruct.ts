import type { SketchData } from "@/types/sketch";
import type { ReplayEvent } from "./types";

let idCounter = 0;

function newEventId(): string {
  return `re-${Date.now()}-${++idCounter}`;
}

export function reconstructFromData(data: SketchData): ReplayEvent[] {
  const events: ReplayEvent[] = [];

  // Convert strokes to events, sorted by first point timestamp
  const sortedStrokes = [...data.strokes].sort((a, b) => {
    const tsA = a.points[0]?.timestamp ?? 0;
    const tsB = b.points[0]?.timestamp ?? 0;
    return tsA - tsB;
  });

  for (const stroke of sortedStrokes) {
    const timestamp = stroke.points[0]?.timestamp ?? 0;
    if (stroke.isShape) {
      events.push({ type: "shape", id: newEventId(), timestamp, stroke });
    }
    else {
      events.push({ type: "stroke", id: newEventId(), timestamp, stroke });
    }
  }

  // Convert non-stroke elements
  if (data.elements) {
    for (const element of data.elements) {
      if (element.type === "text") {
        events.push({ type: "text", id: newEventId(), timestamp: 0, element });
      }
      else if (element.type === "image") {
        events.push({ type: "image", id: newEventId(), timestamp: 0, element });
      }
      // Skip "stroke" elements — already handled via strokes array
    }
  }

  // Sort by timestamp (stable: strokes with timestamps come before elements with timestamp 0)
  events.sort((a, b) => a.timestamp - b.timestamp);

  return events;
}
