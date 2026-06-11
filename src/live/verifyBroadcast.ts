/**
 * 验证 2：思源 Broadcast API 跨设备消息传递
 *
 * 逐步测试 broadcast 端点，判断是否可跨设备传递自定义消息。
 * 结果决定是否可走方案 C（思源 broadcast API）。
 *
 * Broadcast API 端点（均需 admin 认证）：
 *   POST /api/broadcast/getChannels      — JSON: 无参数
 *   POST /api/broadcast/getChannelInfo    — JSON: name
 *   POST /api/broadcast/publish           — multipart/form-data: field name=频道名, value=消息
 *   POST /api/broadcast/postMessage       — JSON: channel, message
 *   GET  /es/broadcast/subscribe?channel= — SSE（event=频道名）
 *   GET  /ws/broadcast?channel=           — WebSocket
 */

import { fetchSyncPost, getFrontend, getBackend } from 'siyuan';

// ---- 类型 ----

export interface BroadcastVerifyStep {
  name: string
  success: boolean
  data?: unknown
  error?: string
  latencyMs?: number
}

export interface BroadcastReport {
  testId: string
  timestamp: number
  frontend: string
  backend: string
  channelName: string
  steps: BroadcastVerifyStep[]
  summary: 'all_pass' | 'partial' | 'fail'
  conclusion: string
}

// ---- 工具函数 ----

function getApiToken(): string {
  try {
    const cfg = (window as any).siyuan?.config;
    if (cfg?.system?.apiToken) return cfg.system.apiToken;
  } catch {}
  const match = document.cookie.match(/symplishuyuan=([^;]+)/);
  if (match) return match[1];
  return '';
}

// ---- API 调用封装（JSON POST） ----

async function callAPI(
  endpoint: string,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: any; error?: string; latencyMs: number }> {
  const start = performance.now();
  try {
    const result = await fetchSyncPost(endpoint, params);
    const latencyMs = Math.round(performance.now() - start);
    if (result.code === 0) {
      return { ok: true, data: result.data, latencyMs };
    } else {
      return { ok: false, error: result.msg || `code=${result.code}`, latencyMs };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, error: err.message || String(err), latencyMs };
  }
}

// ---- publish（FormData，field name=频道名，value=消息） ----

async function callPublish(
  channelName: string,
  message: string,
): Promise<{ ok: boolean; data?: any; error?: string; latencyMs: number }> {
  const start = performance.now();
  try {
    const form = new FormData();
    form.append(channelName, message);

    const token = getApiToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Token ${token}`;

    const res = await fetch('/api/broadcast/publish', {
      method: 'POST',
      headers,
      body: form,
    });
    const result = await res.json();
    const latencyMs = Math.round(performance.now() - start);
    if (result.code === 0) {
      return { ok: true, data: result.data, latencyMs };
    } else {
      return { ok: false, error: result.msg || `code=${result.code}`, latencyMs };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, error: err.message || String(err), latencyMs };
  }
}

// ---- SSE 订阅测试 ----
// 思源 SSE 事件类型 = 频道名（非默认 message），需用 addEventListener

function testSSESubscribe(
  channel: string,
  triggerFn: () => Promise<void>,
  timeoutMs = 8000,
): Promise<BroadcastVerifyStep> {
  return new Promise((resolve) => {
    const token = getApiToken();
    const url = `/es/broadcast/subscribe?channel=${encodeURIComponent(channel)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    let settled = false;
    const settle = (step: BroadcastVerifyStep) => {
      if (settled) return;
      settled = true;
      resolve(step);
    };

    let es: EventSource;
    const timer = setTimeout(() => {
      try { es.close(); } catch {}
      settle({
        name: 'SSE 订阅',
        success: false,
        error: `订阅超时 (${timeoutMs}ms) — 未收到消息`,
      });
    }, timeoutMs);

    try {
      es = new EventSource(url);
    } catch (err: any) {
      clearTimeout(timer);
      settle({ name: 'SSE 订阅', success: false, error: `创建 EventSource 失败: ${err.message}` });
      return;
    }

    // 监听频道名作为 event type（思源 SSE 的 event = 频道名）
    es.addEventListener(channel, (event: MessageEvent) => {
      clearTimeout(timer);
      es.close();
      let parsed: unknown;
      try { parsed = JSON.parse(event.data); } catch { parsed = event.data; }
      settle({
        name: 'SSE 订阅',
        success: true,
        data: { raw: event.data, parsed },
      });
    });

    // 也监听默认 message 事件作为兜底
    es.onmessage = (event) => {
      clearTimeout(timer);
      es.close();
      let parsed: unknown;
      try { parsed = JSON.parse(event.data); } catch { parsed = event.data; }
      settle({
        name: 'SSE 订阅',
        success: true,
        data: { raw: event.data, parsed },
      });
    };

    es.onopen = () => {
      // SSE 连接已建立，触发消息发送
      triggerFn().catch(() => {});
    };

    es.onerror = () => {
      if (!settled) {
        clearTimeout(timer);
        es.close();
        settle({
          name: 'SSE 订阅',
          success: false,
          error: 'EventSource 连接错误（可能 API 不存在或被拒绝）',
        });
      }
    };
  });
}

// ---- WebSocket 订阅测试 ----

function testWsSubscribe(
  channel: string,
  triggerFn: () => Promise<void>,
  timeoutMs = 8000,
): Promise<BroadcastVerifyStep> {
  return new Promise((resolve) => {
    const token = getApiToken();
    const host = location.host;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${host}/ws/broadcast?channel=${encodeURIComponent(channel)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    let settled = false;
    const settle = (step: BroadcastVerifyStep) => {
      if (settled) return;
      settled = true;
      resolve(step);
    };

    let ws: WebSocket;
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      settle({
        name: 'WebSocket 订阅',
        success: false,
        error: `连接超时 (${timeoutMs}ms)`,
      });
    }, timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch (err: any) {
      clearTimeout(timer);
      settle({ name: 'WebSocket 订阅', success: false, error: `创建 WebSocket 失败: ${err.message}` });
      return;
    }

    ws.onopen = () => {
      // WebSocket 连接已建立，触发消息发送
      triggerFn().catch(() => {});
    };

    ws.onmessage = (event) => {
      clearTimeout(timer);
      ws.close();
      let parsed: unknown;
      try { parsed = JSON.parse(event.data as string); } catch { parsed = event.data; }
      settle({
        name: 'WebSocket 订阅',
        success: true,
        data: { raw: event.data, parsed },
      });
    };

    ws.onerror = () => {
      if (!settled) {
        clearTimeout(timer);
        ws.close();
        settle({
          name: 'WebSocket 订阅',
          success: false,
          error: 'WebSocket 连接错误（可能 API 不存在或被拒绝）',
        });
      }
    };

    ws.onclose = (event) => {
      if (!settled) {
        clearTimeout(timer);
        settle({
          name: 'WebSocket 订阅',
          success: false,
          error: `连接关闭: code=${event.code}, reason=${event.reason || '无'}`,
        });
      }
    };
  });
}

// ---- 完整验证流程 ----

export async function runBroadcastVerification(channelName = 'sketch-live-verify'): Promise<BroadcastReport> {
  const testId = `bc-${Date.now().toString(36)}`;
  const frontend = getFrontend();
  const backend = getBackend();
  const steps: BroadcastVerifyStep[] = [];

  const makeTriggerMsg = (type: string) => JSON.stringify({
    type,
    source: frontend,
    backend,
    ts: Date.now(),
    testId,
  });

  // 步骤 1：获取频道列表
  const channelsResult = await callAPI('/api/broadcast/getChannels');
  steps.push({
    name: '获取频道列表 (getChannels)',
    success: channelsResult.ok,
    data: channelsResult.data,
    error: channelsResult.error,
    latencyMs: channelsResult.latencyMs,
  });

  // 步骤 2：查询特定频道信息（JSON，参数名 name）
  const channelInfoResult = await callAPI('/api/broadcast/getChannelInfo', { name: channelName });
  steps.push({
    name: '查询频道信息 (getChannelInfo)',
    success: channelInfoResult.ok,
    data: channelInfoResult.data,
    error: channelInfoResult.error,
    latencyMs: channelInfoResult.latencyMs,
  });

  // 步骤 3：发布消息（FormData，field name = 频道名）
  const publishResult = await callPublish(channelName, makeTriggerMsg('verify-publish'));
  steps.push({
    name: '发布消息 (publish)',
    success: publishResult.ok,
    data: publishResult.data,
    error: publishResult.error,
    latencyMs: publishResult.latencyMs,
  });

  // 步骤 4：发送消息（JSON）
  const postMsgResult = await callAPI('/api/broadcast/postMessage', {
    channel: channelName,
    message: makeTriggerMsg('verify-post'),
  });
  steps.push({
    name: '发送消息 (postMessage)',
    success: postMsgResult.ok,
    data: postMsgResult.data,
    error: postMsgResult.error,
    latencyMs: postMsgResult.latencyMs,
  });

  // 步骤 5：SSE 订阅 — 建立连接后用 postMessage 触发
  const sseStep = await testSSESubscribe(channelName, async () => {
    await callAPI('/api/broadcast/postMessage', {
      channel: channelName,
      message: makeTriggerMsg('verify-sse-trigger'),
    });
  }, 8000);
  steps.push(sseStep);

  // 步骤 6：WebSocket 订阅 — 建立连接后用 postMessage 触发
  const wsStep = await testWsSubscribe(channelName, async () => {
    await callAPI('/api/broadcast/postMessage', {
      channel: channelName,
      message: makeTriggerMsg('verify-ws-trigger'),
    });
  }, 8000);
  steps.push(wsStep);

  // 综合判定
  const passed = steps.filter((s) => s.success).length;
  const hasSubscribe = sseStep.success || wsStep.success;
  const hasPublish = publishResult.ok || postMsgResult.ok;

  let summary: BroadcastReport['summary'];
  let conclusion: string;

  if (passed === steps.length) {
    summary = 'all_pass';
    conclusion = '所有 broadcast API 端点均可访问，跨设备消息传递已验证。可作为传输层候选。';
  } else if (hasSubscribe && hasPublish) {
    summary = 'partial';
    const details = [
      `publish=${publishResult.ok ? '✓' : '✗'}`,
      `postMessage=${postMsgResult.ok ? '✓' : '✗'}`,
      `SSE=${sseStep.success ? '✓' : '✗'}`,
      `WS=${wsStep.success ? '✓' : '✗'}`,
    ].join(', ');
    conclusion = `核心消息收发可用（${details}）。${passed}/${steps.length} 项通过。`;
  } else if (hasPublish) {
    summary = 'partial';
    conclusion = '消息发布可用但订阅失败。broadcast API 可能仅限内部使用，不支持插件自定义订阅。';
  } else {
    summary = 'fail';
    conclusion = 'broadcast API 不可用。该 API 可能未对外暴露或需要特殊权限。应放弃方案 C。';
  }

  return {
    testId,
    timestamp: Date.now(),
    frontend,
    backend,
    channelName,
    steps,
    summary,
    conclusion,
  };
}

// ---- 格式化报告 ----

export function formatBroadcastReport(report: BroadcastReport): string {
  const lines: string[] = [];
  lines.push('=== 闲笔 Broadcast API 验证报告 ===');
  lines.push(`测试 ID: ${report.testId}`);
  lines.push(`时间: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`运行环境: ${report.frontend} / ${report.backend}`);
  lines.push(`测试频道: ${report.channelName}`);
  lines.push('');

  for (const step of report.steps) {
    const icon = step.success ? '✓' : '✗';
    lines.push(`--- ${step.name} ---`);
    lines.push(`  结果: ${icon} ${step.success ? '成功' : '失败'}`);
    if (step.latencyMs != null) lines.push(`  延迟: ${step.latencyMs}ms`);
    if (step.error) lines.push(`  错误: ${step.error}`);
    if (step.data != null) {
      const dataStr = typeof step.data === 'string' ? step.data : JSON.stringify(step.data);
      lines.push(`  数据: ${dataStr.length > 200 ? `${dataStr.slice(0, 200)}...` : dataStr}`);
    }
    lines.push('');
  }

  const icon = report.summary === 'all_pass' ? '✓ 全部通过' : report.summary === 'partial' ? '△ 部分通过' : '✗ 失败';
  lines.push(`=== 综合结论: ${icon} ===`);
  lines.push(report.conclusion);
  return lines.join('\n');
}
