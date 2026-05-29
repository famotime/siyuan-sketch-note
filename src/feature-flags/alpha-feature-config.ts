/**
 * Alpha 功能隐藏配置
 *
 * 编辑下方 ALPHA_FEATURE_HIDE_CONFIG 常量来控制发布版本中隐藏哪些功能。
 * 修改后需重新构建（pnpm build）才能生效。
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 示例 — 隐藏回放功能及其工具栏按钮：                                   │
 * │                                                                     │
 * │   const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {       │
 * │     hiddenSettingKeys: ['replay'],                                  │
 * │     hiddenTopbarKeys: ['replay'],                                   │
 * │   }                                                                 │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * hiddenSettingKeys 可选值：
 *   'replay'  — 录制/回放设置组（含录制开关、回放开关、6 个记录类型子开关、隐藏回放控制栏开关）
 *
 * hiddenTopbarKeys 可选值：
 *   'undo'        — 撤销按钮
 *   'redo'        — 重做按钮
 *   'replay'      — 回放入口按钮
 *   'insertImage' — 插入图片按钮
 *   'zenMode'     — 禅模式按钮
 *   'moreMenu'    — 更多菜单（含清空、背景选择、背景适配、触控笔模式、压感开关）
 */

// ── 类型定义 ──

/** 设置页面中可隐藏的设置组 */
export type HiddenSettingKey = 'replay';

/** 顶部工具栏中可隐藏的按钮 */
export type HiddenTopbarKey =
  | 'undo'
  | 'redo'
  | 'replay'
  | 'insertImage'
  | 'zenMode'
  | 'moreMenu';

export interface AlphaFeatureHideConfig {
  /** 需要隐藏的设置组 key 列表 */
  hiddenSettingKeys: HiddenSettingKey[];
  /** 需要隐藏的顶部工具栏按钮 key 列表 */
  hiddenTopbarKeys: HiddenTopbarKey[];
}

// ── 编辑此对象来控制功能可见性 ──

const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSettingKeys: ['replay'],
  hiddenTopbarKeys: ['replay', 'insertImage'],
};

// ── 工具函数 ──

let _settingKeySet: Set<HiddenSettingKey> | null = null;
let _topbarKeySet: Set<HiddenTopbarKey> | null = null;

export function getHiddenSettingKeySet(): Set<HiddenSettingKey> {
  if (!_settingKeySet) {
    _settingKeySet = new Set(ALPHA_FEATURE_HIDE_CONFIG.hiddenSettingKeys);
  }
  return _settingKeySet;
}

export function getHiddenTopbarKeySet(): Set<HiddenTopbarKey> {
  if (!_topbarKeySet) {
    _topbarKeySet = new Set(ALPHA_FEATURE_HIDE_CONFIG.hiddenTopbarKeys);
  }
  return _topbarKeySet;
}

export function isSettingHidden(key: HiddenSettingKey): boolean {
  return getHiddenSettingKeySet().has(key);
}

export function isTopbarHidden(key: HiddenTopbarKey): boolean {
  return getHiddenTopbarKeySet().has(key);
}
