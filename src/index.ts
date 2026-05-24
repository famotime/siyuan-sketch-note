import {
  Plugin,
  fetchSyncPost,
  getFrontend,
  getActiveEditor,
} from "siyuan";
import "@/index.scss";
import { init, destroy } from "./main";
import { openSketchEditor, setI18n } from "./App.vue";
import { storageKey, createEmptySketchData } from "./storage";
import {
  createPlaceholderPng,
  uploadPngToAssets,
  sketchAssetFileName,
  extractBlockIdFromAsset,
} from "./utils/uploadPng";

const SKETCH_IMAGE_PATTERN = /sketch-note-.+\.png$/;

const ICON_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#icon-06d555852696ccc)"><path style="fill:none!important" d="M30.9995 8.99902L38.9995 16.999" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path style="fill:none!important" d="M7.99953 31.999L35.9994 4L43.9995 11.999L15.9995 39.999L5.99951 41.999L7.99953 31.999Z" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path style="fill:none!important" d="M30.9995 8.99902L38.9995 16.999" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path style="fill:none!important" d="M8.99951 31.999L15.9995 38.999" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path style="fill:none!important" d="M12.9995 34.999L34.9995 12.999" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="icon-06d555852696ccc"><rect width="48" height="48" fill="#333"/></clipPath></defs></svg>`;

export default class SketchNotePlugin extends Plugin {
  public isMobile = false;
  public isBrowser = false;
  public isElectron = false;
  private mutationObserver: MutationObserver | null = null;
  private onOpenMenuImage: ((e: any) => void) | null = null;

  async onload() {
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.isBrowser = frontEnd === "browser-desktop" || frontEnd === "browser-mobile";
    this.isElectron = frontEnd === "desktop";

    // Initialize i18n
    setI18n(this.i18n ?? {});

    // Initialize Vue app
    init(this);

    // MutationObserver: inject edit buttons into sketch-note image blocks
    this.mutationObserver = this.setupImageBlockObserver(document.body);

    // Right-click context menu for sketch-note images
    this.onOpenMenuImage = ({ detail }: { detail: any }) => {
      this.handleOpenMenuImage(detail);
    };
    this.eventBus.on("open-menu-image", this.onOpenMenuImage);

    // Add top bar button
    this.addTopBar({
      icon: ICON_SVG,
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
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.onOpenMenuImage) {
      this.eventBus.off("open-menu-image", this.onOpenMenuImage);
      this.onOpenMenuImage = null;
    }
    destroy();
    delete window.sySketchNote;
  }

  /**
   * Set up MutationObserver to watch for sketch-note image blocks
   * and inject edit buttons into their action bars.
   * Follows the same pattern as siyuan-embed-excalidraw.
   */
  private setupImageBlockObserver(target: Node): MutationObserver {
    const processedElements = new WeakSet<HTMLElement>();

    const handleAddedNode = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;

      // Check the node itself if it's an image block
      if (element.matches?.('[data-type="NodeParagraph"]')) {
        this.tryInjectEditButton(element, processedElements);
      }

      // Check descendants for image blocks
      element.querySelectorAll?.('[data-type="NodeParagraph"]')?.forEach((block) => {
        this.tryInjectEditButton(block as HTMLElement, processedElements);
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          handleAddedNode(node);
        }
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    return observer;
  }

  /**
   * Check if an image block contains a sketch-note image,
   * and if so, inject an edit button into its action bar.
   */
  private tryInjectEditButton(
    blockElement: HTMLElement,
    processedElements: WeakSet<HTMLElement>
  ): void {
    if (processedElements.has(blockElement)) return;

    const imgElement = blockElement.querySelector("img") as HTMLImageElement | null;
    if (!imgElement) return;

    const dataSrc = imgElement.getAttribute("data-src") || "";
    if (!SKETCH_IMAGE_PATTERN.test(dataSrc)) return;

    processedElements.add(blockElement);

    const blockId = extractBlockIdFromAsset(dataSrc);
    if (!blockId) return;

    const actionBar = blockElement.querySelector(".protyle-action");
    if (!actionBar) return;

    const editBtn = document.createElement("span");
    editBtn.className = "b3-tooltips b3-tooltips__se sketch-note-edit-btn";
    editBtn.setAttribute("aria-label", this.i18n?.editSketch ?? "Edit Sketch");
    editBtn.innerHTML = ICON_SVG;
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSketchEditor(blockId);
    });
    actionBar.insertAdjacentElement("afterbegin", editBtn);
  }

  /**
   * Handle right-click menu on images — add "Edit Sketch" for sketch-note images.
   */
  private handleOpenMenuImage(detail: any): void {
    const selectedElement = detail?.element as HTMLElement | undefined;
    if (!selectedElement) return;

    const imgElement = selectedElement.querySelector("img") as HTMLImageElement | null;
    if (!imgElement) return;

    const dataSrc = imgElement.getAttribute("data-src") || imgElement.dataset?.src || "";
    if (!SKETCH_IMAGE_PATTERN.test(dataSrc)) return;

    const blockId = extractBlockIdFromAsset(dataSrc);
    if (!blockId) return;

    window.siyuan.menus.menu.addItem({
      id: "edit-sketch-note",
      label: this.i18n?.editSketch ?? "Edit Sketch",
      iconHTML: ICON_SVG,
      click: () => openSketchEditor(blockId),
    });
  }

  /**
   * Get the current document's root ID.
   */
  private getCurrentDocId(): string | null {
    const editor = getActiveEditor();
    // @ts-ignore - runtime protyle access
    return editor?.protyle?.block?.rootID || null;
  }

  /**
   * Insert a new sketch-note image block into the current document.
   * 1. Upload a placeholder PNG to assets
   * 2. Insert as standard markdown image via /api/block/appendBlock
   * 3. Save empty sketch data to plugin storage
   * 4. Open the editor
   */
  private async insertSketchBlock() {
    const docId = this.getCurrentDocId();
    if (!docId) {
      console.error("[Sketch Note] Cannot get current document. Please open a document first.");
      return;
    }

    const blockId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const fileName = sketchAssetFileName(blockId);

    try {
      // 1. Create and upload placeholder PNG
      const placeholderBlob = createPlaceholderPng("blank");
      await uploadPngToAssets(placeholderBlob, fileName);

      // 2. Insert standard markdown image via API
      const data = `![](${`assets/${fileName}`})`;
      const result = await fetchSyncPost("/api/block/appendBlock", {
        dataType: "markdown",
        data,
        parentID: docId,
      });
      if (result.code !== 0) {
        console.error("[Sketch Note] Failed to insert image block:", result.msg);
        return;
      }

      // 3. Save empty sketch data
      await this.saveData(storageKey(blockId), createEmptySketchData("blank"));

      // 4. Open editor
      await openSketchEditor(blockId);
    } catch (e) {
      console.error("[Sketch Note] Failed to insert sketch block:", e);
    }
  }
}
