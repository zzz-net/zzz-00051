import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import importRoutes from './routes/import.js'
import thresholdRoutes from './routes/thresholds.js'
import anomalyRoutes from './routes/anomalies.js'
import trendRoutes from './routes/trends.js'
import storeRoutes from './routes/stores.js'
import { seedSampleData } from './seedData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

setTimeout(() => {
  seedSampleData()
}, 500)

app.use('/api/auth', authRoutes)
app.use('/api/import', importRoutes)
app.use('/api/thresholds', thresholdRoutes)
app.use('/api/anomalies', anomalyRoutes)
app.use('/api/trends', trendRoutes)
app.use('/api/stores', storeRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(error.stack)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    details: error.message,
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
