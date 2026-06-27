// src/server/index.ts
// Docker-side Express server — serves React build + proxies WebSocket to host runner
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = parseInt(process.env.AC_WEB_PORT ?? '3100', 10)
const UNIX_SOCKET = process.env.AC_UNIX_SOCKET ?? '/run/agent-dispatcher/dispatcher.sock'

// Serve static React build
// Hashed assets (JS/CSS) get long cache; HTML gets no-cache so browsers always fetch latest
const webRoot = join(__dirname, '../../dist/web')
app.use('/assets', express.static(join(webRoot, 'assets'), {
  maxAge: '1y',
  immutable: true,
}))
app.use(express.static(webRoot, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
  },
}))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// SPA fallback — serve index.html for all non-file routes
// Express 5 requires named wildcard params (path-to-regexp v8)
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(join(webRoot, 'index.html'))
})

const server = createServer(app)

// WebSocket proxy: browser ↔ server ↔ runner (Unix socket)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (browserWs) => {
  // Connect to runner via Unix socket
  const runnerWs = new WebSocket(`ws+unix://${UNIX_SOCKET}`)

  runnerWs.on('open', () => {
    console.log('Connected to runner via Unix socket')
  })

  // Runner → Browser
  runnerWs.on('message', (data) => {
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(data.toString())
    }
  })

  // Browser → Runner
  browserWs.on('message', (data) => {
    if (runnerWs.readyState === WebSocket.OPEN) {
      runnerWs.send(data.toString())
    }
  })

  browserWs.on('close', () => runnerWs.close())
  runnerWs.on('close', () => browserWs.close())
  runnerWs.on('error', (err) => console.error('Runner connection error:', err))
  // Without this, an 'error' event on the browser socket is unhandled and
  // crashes the relay process (ws EventEmitters throw on unhandled 'error').
  browserWs.on('error', (err) => {
    console.error('Browser connection error:', err)
    runnerWs.close()
  })
})

server.listen(PORT, () => {
  console.log(`Agent Dispatcher web server on port ${PORT}`)
})
