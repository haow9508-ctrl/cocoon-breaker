/**
 * API Server - 茧房爆破器 反推荐引擎
 * Agent-powered cognitive expansion platform
 * 生产模式：Express 同时托管 API 路由 + 静态前端（dist/）
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import agentRoutes from '../_routes/agent.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/agent', agentRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: '茧房爆破器 Agent 已就绪',
      timestamp: new Date().toISOString(),
    })
  },
)

/**
 * 生产模式：托管前端静态文件（vite build 输出到 dist/）
 * dist/ 位于项目根目录，相对于 api/_core/ 向上两级
 */
const distPath = path.resolve(__dirname, '../../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback：非 /api 路由返回 index.html（支持前端路由刷新）
  app.get('*', (req: Request, res: Response) => {
    // 排除 API 路由
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ success: false, error: 'API not found', path: req.path })
      return
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log(`[Server] 静态前端托管已启用: ${distPath}`)
}

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error.message)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    message: error.message,
  })
})

/**
 * 404 handler（仅开发模式，dist 不存在时）
 */
if (!fs.existsSync(distPath)) {
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API not found',
      path: req.path,
    })
  })
}

export default app
