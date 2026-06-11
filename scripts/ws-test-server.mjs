/**
 * PC 端 WebSocket 测试服务器
 *
 * 用于验证移动端插件环境是否允许连接 PC 局域网 WebSocket。
 * 启动后在终端显示本机局域网 IP 和端口，提供：
 *   - GET  /     HTTP 健康检查（返回 JSON）
 *   - WS   /     WebSocket echo 服务（收到消息后原样回复并附加服务器时间戳）
 *
 * 使用方式：
 *   node scripts/ws-test-server.mjs [port]
 *   node scripts/ws-test-server.mjs 9527
 */

import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { WebSocketServer } from 'ws'

const PORT = Number.parseInt(process.argv[2] || '9527', 10)

// ---- 获取局域网 IP ----

function getLocalIPs() {
  const interfaces = networkInterfaces()
  const results = []
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({ name, address: addr.address })
      }
    }
  }
  return results
}

// ---- HTTP 服务 ----

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end(JSON.stringify({
      ok: true,
      server: 'sketch-note-ws-test',
      ips: getLocalIPs().map(i => i.address),
      port: PORT,
      timestamp: Date.now(),
    }, null, 2))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  }
})

// ---- WebSocket 服务 ----

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const clientAddr = `${req.socket.remoteAddress}:${req.socket.remotePort}`
  console.log(`[WS] 客户端已连接: ${clientAddr}`)

  ws.on('message', (data) => {
    const text = data.toString('utf-8')
    console.log(`[WS] 收到消息: ${text}`)

    let echoData
    try {
      const msg = JSON.parse(text)
      echoData = JSON.stringify({
        ...msg,
        echoFromServer: true,
        serverTimestamp: Date.now(),
        serverIP: getLocalIPs()[0]?.address || 'unknown',
      })
    } catch {
      echoData = JSON.stringify({
        echo: text,
        echoFromServer: true,
        serverTimestamp: Date.now(),
      })
    }

    ws.send(echoData)
  })

  ws.on('close', () => {
    console.log(`[WS] 连接关闭: ${clientAddr}`)
  })

  ws.on('error', (err) => {
    console.error(`[WS] 错误: ${clientAddr}`, err.message)
  })
})

// ---- 启动 ----

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs()
  console.log('')
  console.log('='.repeat(50))
  console.log('  闲笔 WebSocket 测试服务器')
  console.log('='.repeat(50))
  console.log('')
  console.log(`  监听端口: ${PORT}`)
  console.log('')
  console.log('  局域网地址:')
  for (const { name, address } of ips) {
    console.log(`    ${name}: http://${address}:${PORT}/`)
  }
  console.log('')
  console.log('  在移动端闲笔插件中输入以下地址进行测试:')
  if (ips.length > 0) {
    console.log(`    IP: ${ips[0].address}  端口: ${PORT}`)
  }
  console.log('')
  console.log('  按 Ctrl+C 停止服务器')
  console.log('='.repeat(50))
  console.log('')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  错误: 端口 ${PORT} 已被占用，请换一个端口: node scripts/ws-test-server.mjs <port>\n`)
  } else {
    console.error('\n  服务器错误:', err.message, '\n')
  }
  process.exit(1)
})
