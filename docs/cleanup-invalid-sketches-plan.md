# 无效手写笔记清理功能方案

## 背景

闲笔当前以 `sketchId` 作为手写数据文件和缩略图文件的主键：

- 插件数据：`sketch-<sketchId>.json`
- 缩略图：`data/assets/sketch-note-<sketchId>.png`
- 图片 Markdown：`![sketch:<sketchId>](assets/sketch-note-<sketchId>.png)`

但 `sketchId` 不是思源文档块 ID。若用户删除文档中的图片块，插件存储中的手写数据和 assets 缩略图可能残留。与此同时，用户也可能复制图片块，使同一个 `sketchId` 被多个思源块引用。因此清理逻辑必须支持一份手写数据对应多个块引用，只有所有引用都失效时才能删除手写数据。

## 目标

1. 编辑器“更多”菜单增加“清理无效手写笔记”命令。
2. 现存手写笔记在打开并保存后升级为新文件格式，写入 `sketchId` 和当前块 ID 引用信息。
3. 支持同一手写笔记嵌入不同块 ID 的场景。
4. 清理时逐个检查引用块是否仍然存在且仍引用对应手写笔记。
5. 只要任意块仍有效引用该手写笔记，就不能删除手写数据；仅移除失效引用。
6. 清理前双重确认：先确认扫描，再展示统计和警告后确认删除。

## 数据格式

### SketchData V2

在 `SketchData` 中新增可选 `id` 字段，并将保存后的版本升级为 `2`：

```ts
export interface SketchReference {
  blockId: string;
  updatedAt: number;
}

export interface SketchDataIdentity {
  sketchId: string;
  references: SketchReference[];
  createdAt: number;
  updatedAt: number;
}

export interface SketchData {
  version: 1 | 2;
  id?: SketchDataIdentity;
  // existing fields...
}
```

保存时使用 `normalizeSketchDataForSave(data, { sketchId, sourceBlockId })`：

- 旧数据自动升级到 `version: 2`。
- 写入 `id.sketchId`。
- 若存在 `sourceBlockId`，则 upsert 到 `id.references`。
- 保留已有其他引用。

### 全局索引

新增 `sketch-index.json`，用于清理入口快速枚举可管理的手写笔记：

```ts
export interface SketchIndexItem {
  sketchId: string;
  blockIds: string[];
  assetName: string;
  createdAt: number;
  updatedAt: number;
}

export interface SketchIndex {
  version: 1;
  items: Record<string, SketchIndexItem>;
}
```

索引是加速结构，真实引用以手写数据文件内的 `id.references` 为准；扫描时合并两者。

## 引用记录时机

### 新建手写笔记

`insertSketchBlock()` 调用 `/api/block/insertBlock` 或 `/api/block/appendBlock` 后，从返回值提取实际插入块 ID：

```ts
const insertedBlockId = extractInsertedBlockId(result);
```

保存初始数据时写入该块 ID，并更新索引。

### 打开编辑器

`openSketchEditor(sketchId, sourceBlockId?)` 支持传入当前图片块 ID：

- 注入编辑按钮时，从段落块 DOM 的 `data-node-id` 获取。
- 图片右键菜单时，从最近的 `[data-node-id]` 获取。
- 新建/复制插入成功后，从 API 返回值获取。

### 编辑保存

每次保存都用当前 `sourceBlockId` 更新 `id.references` 和索引。因此旧手写笔记只要被打开并保存，就会迁移到新文件格式。

## 清理判定

对每个 `sketchId` 合并：

- `sketch-index.json` 中的 `blockIds`
- `sketch-<sketchId>.json` 中的 `id.references[].blockId`

逐个调用：

```ts
/api/block/getBlockKramdown
```

有效引用必须同时满足：

1. API 返回成功；
2. 块存在；
3. 块 kramdown 内容仍包含 `sketch-note-<sketchId>.png` 或 `sketch:<sketchId>`。

分类：

- `validBlockIds`：有效引用；
- `invalidBlockIds`：块不存在或不再引用该手写笔记；
- `unknownBlockIds`：API 异常，跳过，不删除。

删除规则：

```ts
if (validBlockIds.length > 0 || unknownBlockIds.length > 0) {
  // 不删除手写数据，只移除明确失效的引用
} else {
  // 所有引用明确失效，才允许删除手写数据和缩略图
}
```

为了避免误删，`unknownBlockIds` 也视为保护引用。

## 用户交互

入口：编辑器顶部“更多”菜单。

第一次确认：

> 将检查所有已记录的手写笔记引用，找出已经不再存在于文档中的引用块。检查过程不会立即删除数据，是否继续？

扫描完成后第二次确认：

> 共检查 X 个手写笔记；仍在使用 X 个；可清理 X 个；仅移除失效引用 X 个；检查失败并跳过 X 个。确认后会删除已无任何有效引用的手写数据和缩略图，此操作不可从插件内恢复，建议先备份工作空间。是否确认清理？

执行完成提示：

> 已清理 X 个无效手写笔记，并更新 X 个手写笔记的引用信息。

## 清理内容

可清理项删除：

- `removeData(storageKey(sketchId))`
- `removeData(legacyStorageKey(sketchId))`
- `/api/file/removeFile` 删除 `/data/assets/sketch-note-<sketchId>.png`
- 从 `sketch-index.json` 移除该项

仍有有效/未知引用的项：

- 保留手写数据和缩略图
- 仅把明确失效的 `blockId` 从数据文件和索引移除

## 测试计划

1. V1 数据保存时升级为 V2 并写入引用。
2. 已有 V2 数据保存时追加新块引用且不丢失旧引用。
3. 清理扫描：存在有效引用时不删除数据。
4. 清理扫描：所有引用失效时进入可删除列表。
5. 清理扫描：存在未知引用时不删除数据。
6. 执行清理：可删除项删除数据和资产，保留项只更新引用。
