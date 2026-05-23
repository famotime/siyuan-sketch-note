import type { SketchData } from "@/types/sketch";

type LoadDataFn = (key: string) => Promise<any>;
type OpenEditorFn = (blockId: string) => void;

const SKETCH_SUBTYPE = "sketch-note";
const STORAGE_PREFIX = "sketch:";

/**
 * Render all sketch-note code blocks in the given container.
 * Follows the same pattern as SiYuan's chartRender/mindmapRender:
 *   - Query [data-subtype="sketch-note"]:not([data-render="true"])
 *   - Mark as rendered
 *   - Replace inner DOM with custom thumbnail
 */
export function renderSketchBlocks(
  container: HTMLElement,
  loadData: LoadDataFn,
  openEditor: OpenEditorFn
): void {
  const elements = container.querySelectorAll(
    `[data-subtype="${SKETCH_SUBTYPE}"]:not([data-render="true"])`
  );

  elements.forEach((el) => {
    const blockElement = el as HTMLElement;
    blockElement.setAttribute("data-render", "true");
    renderSingleBlock(blockElement, loadData, openEditor);
  });
}

async function renderSingleBlock(
  blockElement: HTMLElement,
  loadData: LoadDataFn,
  openEditor: OpenEditorFn
): Promise<void> {
  const blockId = blockElement.getAttribute("data-node-id");
  if (!blockId) return;

  // Hide the default code block action bar (language label, copy, edit)
  const actionBar = blockElement.querySelector(".protyle-action");
  if (actionBar) {
    (actionBar as HTMLElement).style.display = "none";
  }

  // Get or create the render target
  let renderTarget = blockElement.querySelector(".sketch-note-render") as HTMLElement | null;
  if (!renderTarget) {
    renderTarget = document.createElement("div");
    renderTarget.className = "sketch-note-render";

    // Hide the original code content
    const codeDom = blockElement.querySelector(".protyle-wysiwyg__dom");
    if (codeDom) {
      (codeDom as HTMLElement).style.display = "none";
    }

    blockElement.appendChild(renderTarget);
  }

  // Load sketch data from plugin storage
  const key = `${STORAGE_PREFIX}${blockId}`;
  const data: SketchData | null = await loadData(key);

  if (data && data.thumbnail) {
    renderTarget.innerHTML = "";
    renderTarget.className = "sketch-note-render sketch-note-render--has-content";

    const img = document.createElement("img");
    img.src = data.thumbnail;
    img.alt = "Sketch Note";
    img.className = "sketch-note-thumbnail";
    renderTarget.appendChild(img);

    const label = document.createElement("div");
    label.className = "sketch-note-label";
    label.textContent = "✏️";
    renderTarget.appendChild(label);
  } else {
    renderTarget.innerHTML = "";
    renderTarget.className = "sketch-note-render sketch-note-render--empty";

    const placeholder = document.createElement("div");
    placeholder.className = "sketch-note-placeholder";
    placeholder.textContent = "✏️ 点击编辑手写笔记";
    renderTarget.appendChild(placeholder);
  }

  // Click handler to open fullscreen editor
  renderTarget.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    openEditor(blockId);
  });
}
