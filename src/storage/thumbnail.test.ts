import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { thumbnailSketchData } from "./thumbnail";
import type { SketchData } from "@/types/sketch";
import type { SketchElement } from "@/elements/model";

describe("thumbnail bounds cropping with eraser", () => {
  let originalDocument: any;

  beforeAll(() => {
    originalDocument = (globalThis as any).document;
  });

  afterAll(() => {
    (globalThis as any).document = originalDocument;
  });

  it("ignores erased stroke bounds and eraser strokes in crop size calculation", () => {
    // 模拟一个包含三条笔画的 sketchData
    // stroke-1: 在很远处的普通画笔，但是在渲染结果中，该区域在像素上我们模拟为透明（被擦除了）
    // stroke-2: 稍微近一点的普通画笔，我们模拟其在 (100, 100) 处有可见像素
    // eraser-1: 像素橡皮擦，涂抹在很远处的 stroke-1 上
    const strokes = [
      {
        id: "stroke-1",
        tool: "pen" as const,
        color: "#111111",
        width: 10,
        opacity: 1,
        points: [
          { x: 500, y: 500, pressure: 0.5, timestamp: 1 },
          { x: 510, y: 510, pressure: 0.5, timestamp: 2 },
        ],
      },
      {
        id: "stroke-2",
        tool: "pen" as const,
        color: "#222222",
        width: 10,
        opacity: 1,
        points: [
          { x: 100, y: 100, pressure: 0.5, timestamp: 3 },
          { x: 110, y: 110, pressure: 0.5, timestamp: 4 },
        ],
      },
      {
        id: "eraser-1",
        tool: "eraser" as const,
        color: "#000000",
        width: 40,
        opacity: 1,
        points: [
          { x: 490, y: 490, pressure: 0.5, timestamp: 5 },
          { x: 520, y: 520, pressure: 0.5, timestamp: 6 },
        ],
      },
    ];

    // 生成对应的 SketchElement 数组，其中包含三个由 strokes 迁移过来的 StrokeElement
    const elements: SketchElement[] = [
      {
        id: "stroke-1",
        type: "stroke",
        stroke: strokes[0],
        bounds: { x: 495, y: 495, width: 20, height: 20 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zIndex: 0,
      },
      {
        id: "stroke-2",
        type: "stroke",
        stroke: strokes[1],
        bounds: { x: 95, y: 95, width: 20, height: 20 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zIndex: 1,
      },
      {
        id: "eraser-1",
        type: "stroke",
        stroke: strokes[2],
        bounds: { x: 470, y: 470, width: 70, height: 70 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zIndex: 2,
      },
    ];

    const data: SketchData = {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes,
      elements,
    };

    const createdCanvases: any[] = [];

    // 建立一个完美的 mock document 对象，防止依赖 jsdom 环境
    (globalThis as any).document = {
      createElement: (tagName: string) => {
        if (tagName === "canvas") {
          const canvas = {
            width: 0,
            height: 0,
            style: {},
            getContext: () => {
              return {
                save: () => {},
                restore: () => {},
                translate: () => {},
                drawImage: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                quadraticCurveTo: () => {},
                stroke: () => {},
                fillRect: () => {},
                strokeRect: () => {},
                fillText: () => {},
                getImageData: (x: number, y: number, w: number, h: number) => {
                  // 这里是像素边界扫描的关键！
                  // 我们构建一个像素数组。只有在 (100, 100) 的位置，它的 alpha > 0 (表示非透明)；
                  // 而 (500, 500) 以及橡皮擦区域的所有像素都是 alpha = 0 (表示已被完全擦除，或者本就是透明的)。
                  const dataArray = new Uint8ClampedArray(w * h * 4);

                  // 我们在 100 x 100 坐标处标记一个可见像素
                  const targetX = 100;
                  const targetY = 100;
                  if (targetX < w && targetY < h) {
                    const idx = (targetY * w + targetX) * 4;
                    dataArray[idx + 3] = 255; // Alpha 通道设为 255
                  }

                  return {
                    data: dataArray,
                    width: w,
                    height: h,
                  };
                },
              };
            },
            toDataURL: () => "data:image/png;base64,mocked",
          };
          createdCanvases.push(canvas);
          return canvas;
        }
        return {};
      },
    } as any;

    thumbnailSketchData(data);

    // 捕获到的最后一个 Canvas 就是 renderToDataUrl 所创建的用于输出最终图片的画布
    const finalCanvas = createdCanvases[createdCanvases.length - 1];
    expect(finalCanvas).toBeDefined();

    // 检查它的宽度和高度。
    // 如果没有修复此 bug：
    // elBounds 会强行把 bounds 撑大到包含 (495, 495) 的区域，加上 PADDING (40) 后，宽度高度会是 500+ 以上。
    // 修复此 bug 后：
    // stroke-1 被 eraser-1 完全擦除，没有任何非透明像素，所以 strokeBounds 只有 (100, 100) 附近被保留。
    // 而 elements 里的 stroke 类型的元素会被过滤掉，不参与 elBounds 计算。
    // 所以最终的 crop 应该是在 (100, 100) 附近，加上 padding 40，裁剪宽度应该大约是 100-200 左右，远小于 500。
    console.log("Captured final canvas dimensions under node mock:", finalCanvas.width, "x", finalCanvas.height);

    // 预期裁剪区域的尺寸应该是比较小的（应该小于 400，精确计算应为 Math.max(width, MIN_WIDTH) 等）
    expect(finalCanvas.width).toBeLessThan(400);
    expect(finalCanvas.height).toBeLessThan(400);
  });
});
