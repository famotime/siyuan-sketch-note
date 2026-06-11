/**
 * 验证 1：移动端 WebSocket 连接 PC 局域网
 *
 * 测试移动端插件 WebView 环境能否通过 WebSocket 和 HTTP 访问 PC 局域网地址。
 * 结果决定是否可走方案 A（局域网直连）。
 */

import { getFrontend, getBackend } from 'siyuan';

// ---- 类型 ----

export interface WsVerifyResult {
  success: boolean
  phase: 'connect' | 'send' | 'receive' | 'close' | 'timeout'
  latencyMs?: number
  sendLatencyMs?: number
  error?: string
}

export interface HttpVerifyResult {
  success: boolean
  status?: number
  latencyMs?: number
  serverInfo?: {
    ips?: string[]
    port?: number
    timestamp?: number
  }
  error?: string
}

export interface VerificationReport {
  testId: string
  timestamp: number
  frontend: string
  backend: string
  targetHost: string
  targetPort: number
  http: HttpVerifyResult
  ws: WsVerifyResult
  summary: 'pass' | 'partial' | 'fail'
}

// ---- HTTP 连通性测试 ----

export async function verifyHttpConnection(host: string, port: number): Promise<HttpVerifyResult> {
  const url = `http://${host}:${port}/`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      return { success: false, status: res.status, latencyMs, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      status: res.status,
      latencyMs,
      serverInfo: {
        ips: data.ips,
        port: data.port,
        timestamp: data.timestamp,
      },
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { success: false, latencyMs, error: err.message || String(err) };
  }
}

// ---- WebSocket 连通性测试 ----

export function verifyWsConnection(host: string, port: number): Promise<WsVerifyResult> {
  return new Promise((resolve) => {
    const url = `ws://${host}:${port}/`;
    let phase: WsVerifyResult['phase'] = 'connect';
    let connectTime = 0;
    let sendTime = 0;
    let settled = false;

    const settle = (result: WsVerifyResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let ws: WebSocket;
    const timeout = setTimeout(() => {
      phase = 'timeout';
      settle({ success: false, phase, error: `连接超时 (10s)，当前阶段: ${phase}` });
      try { ws.close(); } catch {}
    }, 10000);

    try {
      ws = new WebSocket(url);
    } catch (err: any) {
      clearTimeout(timeout);
      settle({ success: false, phase: 'connect', error: `创建 WebSocket 失败: ${err.message}` });
      return;
    }

    ws.onopen = () => {
      phase = 'send';
      connectTime = Math.round(performance.now() - connectTime);

      // 发送测试消息
      sendTime = performance.now();
      const testMsg = JSON.stringify({ type: 'verify-ping', ts: Date.now() });
      try {
        ws.send(testMsg);
      } catch (err: any) {
        clearTimeout(timeout);
        settle({ success: false, phase: 'send', latencyMs: connectTime, error: `发送失败: ${err.message}` });
      }
    };

    ws.onmessage = (event) => {
      phase = 'receive';
      const sendLatencyMs = Math.round(performance.now() - sendTime);

      try {
        const msg = JSON.parse(event.data as string);
        if (msg.echoFromServer) {
          clearTimeout(timeout);
          settle({
            success: true,
            phase,
            latencyMs: connectTime,
            sendLatencyMs,
          });
          ws.close();
        }
      } catch {
        clearTimeout(timeout);
        settle({
          success: true,
          phase,
          latencyMs: connectTime,
          sendLatencyMs,
        });
        ws.close();
      }
    };

    ws.onerror = (_event) => {
      clearTimeout(timeout);
      settle({
        success: false,
        phase,
        latencyMs: phase !== 'connect' ? connectTime : undefined,
        error: `WebSocket 错误 (阶段: ${phase})`,
      });
    };

    ws.onclose = (event) => {
      clearTimeout(timeout);
      if (!settled) {
        settle({
          success: false,
          phase,
          error: `连接关闭: code=${event.code}, reason=${event.reason || '无'}`,
        });
      }
    };

    connectTime = performance.now();
  });
}

// ---- 完整验证流程 ----

export async function runWsVerification(host: string, port: number): Promise<VerificationReport> {
  const testId = `ws-${Date.now().toString(36)}`;
  const frontend = getFrontend();
  const backend = getBackend();

  // 步骤 1：HTTP 探测
  const http = await verifyHttpConnection(host, port);

  // 步骤 2：WebSocket 连接测试
  const ws = await verifyWsConnection(host, port);

  // 综合判定
  let summary: VerificationReport['summary'];
  if (http.success && ws.success) {
    summary = 'pass';
  } else if (http.success || ws.success) {
    summary = 'partial';
  } else {
    summary = 'fail';
  }

  return { testId, timestamp: Date.now(), frontend, backend, targetHost: host, targetPort: port, http, ws, summary };
}

// ---- 格式化报告为可读文本 ----

export function formatReport(report: VerificationReport): string {
  const lines: string[] = [];
  lines.push('=== 闲笔 WebSocket 连接验证报告 ===');
  lines.push(`测试 ID: ${report.testId}`);
  lines.push(`时间: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`运行环境: ${report.frontend} / ${report.backend}`);
  lines.push(`目标地址: ${report.targetHost}:${report.targetPort}`);
  lines.push('');
  lines.push('--- HTTP 连通性 ---');
  lines.push(`  结果: ${report.http.success ? '✓ 成功' : '✗ 失败'}`);
  if (report.http.latencyMs != null) lines.push(`  延迟: ${report.http.latencyMs}ms`);
  if (report.http.status != null) lines.push(`  状态码: ${report.http.status}`);
  if (report.http.serverInfo) lines.push(`  服务器: ${JSON.stringify(report.http.serverInfo)}`);
  if (report.http.error) lines.push(`  错误: ${report.http.error}`);
  lines.push('');
  lines.push('--- WebSocket 连通性 ---');
  lines.push(`  结果: ${report.ws.success ? '✓ 成功' : '✗ 失败'}`);
  if (report.ws.phase) lines.push(`  阶段: ${report.ws.phase}`);
  if (report.ws.latencyMs != null) lines.push(`  连接延迟: ${report.ws.latencyMs}ms`);
  if (report.ws.sendLatencyMs != null) lines.push(`  消息往返: ${report.ws.sendLatencyMs}ms`);
  if (report.ws.error) lines.push(`  错误: ${report.ws.error}`);
  lines.push('');
  lines.push(`=== 综合结论: ${report.summary === 'pass' ? '✓ 通过 — 可走局域网直连方案' : report.summary === 'partial' ? '△ 部分通过 — 需进一步排查' : '✗ 失败 — 需评估替代方案'} ===`);
  return lines.join('\n');
}
