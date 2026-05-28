import {
  Plugin,
  Setting,
  fetchSyncPost,
  getFrontend,
  getActiveEditor,
} from "siyuan";
import "@/index.scss";
import { init, destroy } from "./main";
import { openSketchEditor, setI18n, setReplayRecordConfig, setHideReplayControls } from "./App.vue";
import { storageKey, createEmptySketchData, loadEditorPreferences } from "./storage";
import { loadPluginSettings, savePluginSettings } from "./storage/pluginSettings";
import type { ReplayEventType } from "./recorder/types";
import { setDebugLogEnabled } from "./utils/logger";
import {
  createPlaceholderPng,
  uploadPngToAssets,
  sketchAssetFileName,
  extractBlockIdFromAsset,
} from "./utils/uploadPng";

const SKETCH_IMAGE_PATTERN = /sketch-note-.+\.png$/;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><path d="M5.414 38.35a3.033 3.033 0 0 1-.62.506c-.626.38-1.31.435-1.937.29-.094-.021-.142-.036-.13-.031-1.399-.551-2.88.585-2.714 2.08 1.268 11.415 19.239 11.88 23.796.524a2 2 0 0 0-.45-2.167l-9.068-8.956a1.995 1.995 0 0 0-1.402-.575c-4.567 0-6.186 1.992-6.835 6.043l-.03.196c-.216 1.352-.361 1.828-.61 2.09zM20 41.37c-3.355 5.69-12.19 5.987-15 1.705a6.642 6.642 0 0 0 2.103-.822 7.125 7.125 0 0 0 1.463-1.168c1.036-1.072 1.341-2.051 1.693-4.23l.03-.192c.33-2.025.59-2.557 2.134-2.663L20 41.37zm3.37-4.634a4.314 4.314 0 0 0 6.128.003l.234-.23.701-.7c.753-.755 1.592-1.608 2.494-2.543 2.58-2.67 5.16-5.46 7.57-8.234a142.055 142.055 0 0 0 3.486-4.158C51.226 11.87 54.143 5.994 50.301 3c-3.41-2.658-8.99.134-17.087 6.63a130.127 130.127 0 0 0-4.51 3.802 200.127 200.127 0 0 0-8.099 7.564 205.356 205.356 0 0 0-3.173 3.193l-.245.254c-1.644 1.68-1.626 4.42.045 6.104l6.138 6.19zm2.877-2.831l-6.143-6.193a.375.375 0 0 1-.008-.508l.243-.253a201.487 201.487 0 0 1 3.107-3.125 196.32 196.32 0 0 1 7.94-7.413 126.252 126.252 0 0 1 4.374-3.687c3.214-2.578 6.024-4.507 8.28-5.636 2.135-1.067 3.479-1.264 3.867-.961.216.168.115 1.27-.939 3.39-1.163 2.34-3.239 5.346-6.04 8.828-1.046 1.3-2.18 2.65-3.39 4.042a212.273 212.273 0 0 1-7.434 8.083 219.059 219.059 0 0 1-3.372 3.412c-.15.151-.356.15-.485.021z" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round" fill-rule="nonzero"/></svg>`;

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

    const pluginSettings = await loadPluginSettings((key) => this.loadData(key));
    setDebugLogEnabled(pluginSettings.enableDebugLog);
    setReplayRecordConfig(pluginSettings.replayRecordConfig);
    setHideReplayControls(pluginSettings.hideReplayControls);

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

  openSetting() {
    void this.openPluginSetting();
  }

  private async openPluginSetting() {
    const settings = await loadPluginSettings((key) => this.loadData(key));
    const setting = new Setting({ width: "520px" });

    setting.addItem({
      title: this.i18n?.debugLog ?? "Debug log",
      description: this.i18n?.debugLogDesc ?? "Print diagnostic logs to the console.",
      createActionElement: () => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "b3-switch fn__flex-center";
        checkbox.checked = settings.enableDebugLog;
        checkbox.addEventListener("change", async () => {
          settings.enableDebugLog = checkbox.checked;
          setDebugLogEnabled(checkbox.checked);
          await savePluginSettings((key, data) => this.saveData(key, data), settings);
        });
        return checkbox;
      },
    });

    // Replay recording toggles
    setting.addItem({
      title: this.i18n?.replayRecord ?? "Replay Recording",
    });
    const recordTypeLabels: Record<ReplayEventType, () => string> = {
      stroke: () => this.i18n?.replayRecordStroke ?? "Strokes",
      erase: () => this.i18n?.replayRecordErase ?? "Eraser",
      shape: () => this.i18n?.replayRecordShape ?? "Shapes",
      text: () => this.i18n?.replayRecordText ?? "Text",
      image: () => this.i18n?.replayImageOp ?? "Image Insert",
      imageTransform: () => this.i18n?.replayImageTransform ?? "Image Transform",
      imageDelete: () => this.i18n?.replayImageDelete ?? "Image Delete",
      toolSwitch: () => this.i18n?.replayToolSwitch ?? "Tool Switch",
    };

    const recordTypes: ReplayEventType[] = ["stroke", "erase", "shape", "text", "image", "imageTransform", "imageDelete", "toolSwitch"];

    for (const type of recordTypes) {
      setting.addItem({
        title: recordTypeLabels[type](),
        createActionElement: () => {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "b3-switch fn__flex-center";
          checkbox.checked = settings.replayRecordConfig[type];
          checkbox.addEventListener("change", async () => {
            settings.replayRecordConfig[type] = checkbox.checked;
            setReplayRecordConfig(settings.replayRecordConfig);
            await savePluginSettings((key, data) => this.saveData(key, data), settings);
          });
          return checkbox;
        },
      });
    }

    setting.addItem({
      title: this.i18n?.hideReplayControls ?? "Hide replay controls",
      description: this.i18n?.hideReplayControlsDesc ?? "Hide the replay control bar during playback.",
      createActionElement: () => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "b3-switch fn__flex-center";
        checkbox.checked = settings.hideReplayControls;
        checkbox.addEventListener("change", async () => {
          settings.hideReplayControls = checkbox.checked;
          setHideReplayControls(checkbox.checked);
          await savePluginSettings((key, data) => this.saveData(key, data), settings);
        });
        return checkbox;
      },
    });

    setting.open(this.name);
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
    // @ts-expect-error - 运行时 protyle 存取
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
      const editorPreferences = await loadEditorPreferences((key) => this.loadData(key));

      // 1. 创建并上传占位图片
      const placeholderBlob = createPlaceholderPng(editorPreferences.template);
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
        // @ts-expect-error - 访问思源未公开的 protyle 运行时属性
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
      await this.saveData(storageKey(blockId), createEmptySketchData(editorPreferences));

      // 5. 打开手写编辑器
      await openSketchEditor(blockId);
    } catch (e) {
      console.error("[Sketch Note] 插入手写块失败:", e);
    }
  }
}
