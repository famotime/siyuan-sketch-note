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
import { createHash } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { parse } from 'node:url'

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
  const { pathname } = parse(req.url || '/', true)
  if (pathname === '/') {
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
  } else if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  }
})

// ---- WebSocket 升级处理 ----
// 使用原生 HTTP upgrade 事件实现轻量 WebSocket echo，
// 避免引入 ws 依赖（减少脚本外部依赖）

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url || '/', true)
  if (pathname !== '/') {
    socket.destroy()
    return
  }

  // WebSocket 握手
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.destroy()
    return
  }

  // RFC 6455 magic string
  const MAGIC = '258EAFA5-E914-47DA-95CA-5AB5DC7185D3'
  const acceptKey = createHash('sha1')
    .update(key + MAGIC)
    .digest('base64')

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    '',
  ]
  socket.write(headers.join('\r\n'))

  const clientAddr = `${req.socket.remoteAddress}:${req.socket.remotePort}`
  console.log(`[WS] 客户端已连接: ${clientAddr}`)

  // ---- WebSocket 帧解析/构造 ----

  function decodeFrame(buf) {
    if (buf.length < 2) return null
    const firstByte = buf[0]
    const secondByte = buf[1]
    const fin = (firstByte & 0x80) !== 0
    const opcode = firstByte & 0x0f
    const masked = (secondByte & 0x80) !== 0
    let payloadLen = secondByte & 0x7f
    let offset = 2

    if (payloadLen === 126) {
      if (buf.length < offset + 2) return null
      payloadLen = buf.readUInt16BE(offset)
      offset += 2
    } else if (payloadLen === 127) {
      if (buf.length < offset + 8) return null
      payloadLen = Number(buf.readBigUInt64BE(offset))
      offset += 8
    }

    let maskingKey = null
    if (masked) {
      if (buf.length < offset + 4) return null
      maskingKey = buf.subarray(offset, offset + 4)
      offset += 4
    }

    if (buf.length < offset + payloadLen) return null

    const payload = Buffer.from(buf.subarray(offset, offset + payloadLen))
    if (masked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4]
      }
    }

    return {
      fin,
      opcode,
      payload,
      totalLength: offset + payloadLen,
    }
  }

  function encodeFrame(payload, opcode = 0x01) {
    const data = Buffer.from(payload)
    let header
    if (data.length < 126) {
      header = Buffer.alloc(2)
      header[0] = 0x80 | opcode
      header[1] = data.length
    } else if (data.length < 65536) {
      header = Buffer.alloc(4)
      header[0] = 0x80 | opcode
      header[1] = 126
      header.writeUInt16BE(data.length, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x80 | opcode
      header[1] = 127
      header.writeBigUInt64BE(BigInt(data.length), 2)
    }
    return Buffer.concat([header, data])
  }

  let buffer = Buffer.alloc(0)

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length > 0) {
      const frame = decodeFrame(buffer)
      if (!frame) break

      buffer = buffer.subarray(frame.totalLength)

      // Ping → Pong
      if (frame.opcode === 0x09) {
        socket.write(encodeFrame(frame.payload, 0x0a))
        continue
      }

      // Close
      if (frame.opcode === 0x08) {
        socket.write(encodeFrame(frame.payload, 0x08))
        socket.end()
        console.log(`[WS] 客户端断开: ${clientAddr}`)
        return
      }

      // Text frame → echo 回复
      if (frame.opcode === 0x01) {
        const text = frame.payload.toString('utf-8')
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

        socket.write(encodeFrame(echoData))
      }
    }
  })

  socket.on('close', () => {
    console.log(`[WS] 连接关闭: ${clientAddr}`)
  })

  socket.on('error', (err) => {
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
