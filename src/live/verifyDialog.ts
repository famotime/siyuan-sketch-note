/**
 * 技术验证对话框 UI
 *
 * 提供两个独立的验证面板入口：
 * 1. WS 连接测试 — 验证移动端 WebView 能否连接 PC 局域网 WebSocket
 * 2. Broadcast 测试 — 验证思源 broadcast API 能否跨设备传递消息
 */

import { Dialog, showMessage } from 'siyuan';
import { runWsVerification, formatReport } from './verifyWsConnect';
import { runBroadcastVerification, formatBroadcastReport } from './verifyBroadcast';

// ---- 通用工具 ----

function getStoredIP(): string {
  try { return localStorage.getItem('sketch-verify-ip') || '192.168.1.1'; } catch { return '192.168.1.1'; }
}

function setStoredIP(ip: string) {
  try { localStorage.setItem('sketch-verify-ip', ip); } catch {}
}

function getStoredPort(): string {
  try { return localStorage.getItem('sketch-verify-port') || '9527'; } catch { return '9527'; }
}

function setStoredPort(port: string) {
  try { localStorage.setItem('sketch-verify-port', port); } catch {}
}

// ---- WS 连接测试对话框 ----

export function openWsVerifyDialog(): void {
  const savedIP = getStoredIP();
  const savedPort = getStoredPort();

  // eslint-disable-next-line no-new -- Dialog 构造函数自动创建并显示弹窗
  new Dialog({
    title: 'WS 连接测试（验证 1）',
    width: '600px',
    height: '520px',
    content: `
      <div class="b3-dialog__content" style="display:flex;flex-direction:column;gap:12px;padding:16px;">
        <div style="font-size:13px;color:var(--b3-theme-on-surface-light);line-height:1.5;">
          测试移动端插件环境能否通过 WebSocket 和 HTTP 访问 PC 局域网地址。<br>
          请先在 PC 端运行: <code style="background:var(--b3-theme-surface);padding:2px 6px;border-radius:3px;">node scripts/ws-test-server.mjs</code>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="font-size:13px;white-space:nowrap;">PC IP:</label>
          <input
            id="verify-ip"
            class="b3-text-field"
            type="text"
            value="${savedIP}"
            placeholder="192.168.1.100"
            style="flex:1;"
          />
          <label style="font-size:13px;white-space:nowrap;">端口:</label>
          <input
            id="verify-port"
            class="b3-text-field"
            type="text"
            value="${savedPort}"
            placeholder="9527"
            style="width:80px;"
          />
          <button id="verify-ws-btn" class="b3-button b3-button--outline" style="white-space:nowrap;">
            开始测试
          </button>
        </div>
        <div id="verify-ws-status" style="font-size:12px;color:var(--b3-theme-on-surface-light);min-height:18px;"></div>
        <pre id="verify-ws-output" style="
          flex:1;
          background:var(--b3-theme-surface);
          border:1px solid var(--b3-theme-border);
          border-radius:6px;
          padding:12px;
          font-size:12px;
          line-height:1.6;
          overflow:auto;
          white-space:pre-wrap;
          word-break:break-all;
          min-height:200px;
          color:var(--b3-theme-on-surface);
        ">等待测试...</pre>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="verify-ws-copy" class="b3-button b3-button--outline" style="font-size:12px;">
            复制结果
          </button>
        </div>
      </div>
    `,
  });

  const btn = document.getElementById('verify-ws-btn')!;
  const status = document.getElementById('verify-ws-status')!;
  const output = document.getElementById('verify-ws-output')!;
  const copyBtn = document.getElementById('verify-ws-copy')!;
  const ipInput = document.getElementById('verify-ip') as HTMLInputElement;
  const portInput = document.getElementById('verify-port') as HTMLInputElement;

  btn.addEventListener('click', async () => {
    const ip = ipInput.value.trim();
    const port = Number.parseInt(portInput.value.trim(), 10);

    if (!ip) {
      showMessage('请输入 PC 的局域网 IP', 3000, 'error');
      return;
    }
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      showMessage('端口无效', 3000, 'error');
      return;
    }

    setStoredIP(ip);
    setStoredPort(String(port));

    btn.setAttribute('disabled', 'true');
    btn.textContent = '测试中...';
    status.textContent = '正在测试 HTTP 连通性...';
    output.textContent = '请稍候...\n';

    try {
      const report = await runWsVerification(ip, port);
      output.textContent = formatReport(report);
      status.textContent = report.summary === 'pass' ? '✓ 测试通过' : report.summary === 'partial' ? '△ 部分通过' : '✗ 测试失败';
    } catch (err: any) {
      output.textContent = `测试异常: ${err.message || err}`;
      status.textContent = '✗ 测试异常';
    } finally {
      btn.removeAttribute('disabled');
      btn.textContent = '开始测试';
    }
  });

  copyBtn.addEventListener('click', () => {
    const text = output.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      showMessage('已复制到剪贴板', 2000);
    }).catch(() => {
      showMessage('复制失败，请手动选中复制', 3000, 'error');
    });
  });
}

// ---- Broadcast 测试对话框 ----

export function openBroadcastVerifyDialog(): void {
  // eslint-disable-next-line no-new -- Dialog 构造函数自动创建并显示弹窗
  new Dialog({
    title: 'Broadcast API 测试（验证 2）',
    width: '600px',
    height: '580px',
    content: `
      <div class="b3-dialog__content" style="display:flex;flex-direction:column;gap:12px;padding:16px;">
        <div style="font-size:13px;color:var(--b3-theme-on-surface-light);line-height:1.5;">
          逐步测试思源内核的 6 个 broadcast API 端点，判断是否可跨设备传递自定义消息。<br>
          <strong>测试步骤：</strong> getChannels → getChannelInfo → SSE 订阅 → publish → postMessage → WS 订阅
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="font-size:13px;white-space:nowrap;">频道名:</label>
          <input
            id="verify-bc-channel"
            class="b3-text-field"
            type="text"
            value="sketch-live-verify"
            placeholder="sketch-live-verify"
            style="flex:1;"
          />
          <button id="verify-bc-btn" class="b3-button b3-button--outline" style="white-space:nowrap;">
            开始测试
          </button>
        </div>
        <div id="verify-bc-status" style="font-size:12px;color:var(--b3-theme-on-surface-light);min-height:18px;"></div>
        <pre id="verify-bc-output" style="
          flex:1;
          background:var(--b3-theme-surface);
          border:1px solid var(--b3-theme-border);
          border-radius:6px;
          padding:12px;
          font-size:12px;
          line-height:1.6;
          overflow:auto;
          white-space:pre-wrap;
          word-break:break-all;
          min-height:240px;
          color:var(--b3-theme-on-surface);
        ">等待测试...</pre>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="verify-bc-copy" class="b3-button b3-button--outline" style="font-size:12px;">
            复制结果
          </button>
        </div>
      </div>
    `,
  });

  const btn = document.getElementById('verify-bc-btn')!;
  const status = document.getElementById('verify-bc-status')!;
  const output = document.getElementById('verify-bc-output')!;
  const copyBtn = document.getElementById('verify-bc-copy')!;
  const channelInput = document.getElementById('verify-bc-channel') as HTMLInputElement;

  btn.addEventListener('click', async () => {
    const channel = channelInput.value.trim() || 'sketch-live-verify';

    btn.setAttribute('disabled', 'true');
    btn.textContent = '测试中...';
    status.textContent = '正在测试 broadcast API...';
    output.textContent = '请稍候，测试过程约需 10 秒...\n';

    try {
      const report = await runBroadcastVerification(channel);
      output.textContent = formatBroadcastReport(report);

      const icon = report.summary === 'all_pass' ? '✓' : report.summary === 'partial' ? '△' : '✗';
      status.textContent = `${icon} ${report.conclusion}`;
    } catch (err: any) {
      output.textContent = `测试异常: ${err.message || err}`;
      status.textContent = '✗ 测试异常';
    } finally {
      btn.removeAttribute('disabled');
      btn.textContent = '开始测试';
    }
  });

  copyBtn.addEventListener('click', () => {
    const text = output.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      showMessage('已复制到剪贴板', 2000);
    }).catch(() => {
      showMessage('复制失败，请手动选中复制', 3000, 'error');
    });
  });
}
