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
      hotkey: "⌃⇧S",
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
   * 设置 MutationObserver 观察手写块图像元素
   * 并将编辑按钮注入其动作条（action bar）中。
   * 监听 childList 变化以及图片 data-src 和 src 属性变化，以应对图片延迟/懒加载。
   */
  private setupImageBlockObserver(target: Node): MutationObserver {
    const handleAddedNode = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;

      // 检查节点本身是否为段落块（思源的图片包裹在 NodeParagraph 块中）
      if (element.matches?.('[data-type="NodeParagraph"]')) {
        this.tryInjectEditButton(element);
      }

      // 检查子代元素中是否有段落块
      element.querySelectorAll?.('[data-type="NodeParagraph"]')?.forEach((block) => {
        this.tryInjectEditButton(block as HTMLElement);
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            handleAddedNode(node);
          }
        } else if (mutation.type === "attributes") {
          const targetElement = mutation.target as HTMLElement;
          // 当图片的源地址发生变化（例如懒加载触发或刷新），重新注入编辑按钮
          if (targetElement.tagName === "IMG") {
            const block = targetElement.closest('[data-type="NodeParagraph"]');
            if (block) {
              this.tryInjectEditButton(block as HTMLElement);
            }
          }
        }
      }
    });

    // 观察子树的节点添加、属性变更（针对图片源地址懒加载）
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-src", "src"],
    });
    return observer;
  }

  /**
   * 检查段落块中是否包含手写图片，如果包含则在其操作条中注入“编辑手写块”按钮。
   * 使用 DOM 存在性检查替代 WeakSet，更安全地应对思源编辑器的局部重绘。
   */
  private tryInjectEditButton(blockElement: HTMLElement): void {
    // 避免重复注入：如果动作栏中已经存在编辑按钮，则直接返回
    if (blockElement.querySelector(".sketch-note-edit-btn")) return;

    const imgElement = blockElement.querySelector("img") as HTMLImageElement | null;
    if (!imgElement) return;

    const dataSrc = imgElement.getAttribute("data-src") || imgElement.getAttribute("src") || "";
    if (!SKETCH_IMAGE_PATTERN.test(dataSrc)) return;

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
   * 处理右键菜单——为手写图增加“编辑手写块”选项。
   */
  private handleOpenMenuImage(detail: any): void {
    const selectedElement = detail?.element as HTMLElement | undefined;
    if (!selectedElement) return;

    const imgElement = selectedElement.querySelector("img") as HTMLImageElement | null;
    if (!imgElement) return;

    const dataSrc = imgElement.getAttribute("data-src") || imgElement.dataset?.src || imgElement.getAttribute("src") || "";
    if (!SKETCH_IMAGE_PATTERN.test(dataSrc)) return;

    const blockId = extractBlockIdFromAsset(dataSrc);
    if (!blockId) return;

    window.siyuan.menus.menu.addItem({
      id: "edit-sketch-note",
      icon: "iconEdit",
      label: this.i18n?.editSketch ?? "Edit Sketch",
      click: () => openSketchEditor(blockId),
    });
  }

  /**
   * 获取当前文档根 ID。
   */
  private getCurrentDocId(): string | null {
    const editor = getActiveEditor();
    // @ts-ignore - 运行时 protyle 存取
    return editor?.protyle?.block?.rootID || null;
  }

  /**
   * 在当前文档中插入一个新的手写块。
   * 1. 尝试通过选区/光标定位聚焦块的 ID，以在其下方精准插入。
   * 2. 创建并上传空的占位 PNG。
   * 3. 根据定位调用 /api/block/insertBlock（在光标下插入）或 /api/block/appendBlock（降级追加到文档末尾）。
   * 4. 保存空白手写数据并打开手写编辑器。
   */
  private async insertSketchBlock() {
    const docId = this.getCurrentDocId();
    if (!docId) {
      console.error("[Sketch Note] 无法获取当前文档。请先打开一个文档。");
      return;
    }

    const blockId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const fileName = sketchAssetFileName(blockId);

    try {
      // 1. 创建并上传占位图片
      const placeholderBlob = createPlaceholderPng("blank");
      await uploadPngToAssets(placeholderBlob, fileName);

      // 2. 尝试通过高精度的“三重保障机制”获取当前编辑区内光标聚焦块的 ID
      let focusedBlockId: string | null = null;
      const editor = getActiveEditor();
      
      if (editor?.protyle) {
        let range: Range | null = null;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
        }
        
        // 【第一重保障】：如果常规选区为空，或选区超出了当前编辑区的 DOM 容器范围，
        // 则尝试读取思源 protyle 对象在失去焦点前暂存的 range 缓存
        // @ts-ignore - 访问思源未公开的 protyle 运行时属性
        const protyleRange = editor.protyle.range || editor.protyle.toolbar?.range;
        if (!range || range.startContainer === document.body || !editor.protyle.wysiwyg?.element?.contains(range.startContainer)) {
          if (protyleRange) {
            range = protyleRange;
          }
        }

        // 根据确定的 range 向上寻祖，找到带有 [data-node-id] 属性的最近块级容器
        if (range) {
          let node: Node | null = range.startContainer;
          while (node && node !== document.body) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              const id = element.getAttribute("data-node-id");
              if (id) {
                focusedBlockId = id;
                break;
              }
            }
            node = node.parentNode;
          }
        }

        // 【第二重保障】：若 range 查找落空，直接搜寻当前编辑器 DOM 中具有聚焦标记 .protyle-wysiwyg--focus 的块
        if (!focusedBlockId && editor.protyle.wysiwyg?.element) {
          const focusElement = editor.protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--focus");
          if (focusElement) {
            focusedBlockId = focusElement.getAttribute("data-node-id");
          }
        }

        // 【第三重保障】：作为保底，若存在处于 active 状态的子元素，则试图从该活动元素向上回溯块 ID
        if (!focusedBlockId && editor.protyle.wysiwyg?.element) {
          const activeEl = document.activeElement;
          if (activeEl && editor.protyle.wysiwyg.element.contains(activeEl)) {
            const block = activeEl.closest("[data-node-id]");
            if (block) {
              focusedBlockId = block.getAttribute("data-node-id");
            }
          }
        }
      }

      // 3. 构建插入 markdown 数据并通过思源 API 插入
      const data = `![](${`assets/${fileName}`})`;
      let result;

      if (focusedBlockId) {
        // 在光标聚焦块的后方精准插入
        result = await fetchSyncPost("/api/block/insertBlock", {
          dataType: "markdown",
          data,
          previousID: focusedBlockId,
        });
      } else {
        // 无焦点时降级追加至文档末尾
        result = await fetchSyncPost("/api/block/appendBlock", {
          dataType: "markdown",
          data,
          parentID: docId,
        });
      }

      if (result.code !== 0) {
        console.error("[Sketch Note] 插入图片块失败:", result.msg);
        return;
      }

      // 4. 保存初始空手写数据
      await this.saveData(storageKey(blockId), createEmptySketchData("blank"));

      // 5. 打开手写编辑器
      await openSketchEditor(blockId);
    } catch (e) {
      console.error("[Sketch Note] 插入手写块失败:", e);
    }
  }
}
