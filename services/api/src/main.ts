import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load .env from root and local folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

// Strict startup security check: Do not start if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is missing.');
  console.error('Refusing to start API server with insecure authentication configuration.');
  process.exit(1);
}

import { authRouter } from './routes/auth.js';
import { creatorsRouter } from './routes/creators.js';
import { collabsRouter } from './routes/collabs.js';
import { webhooksRouter } from './routes/webhooks.js';
import { mediaRouter } from './routes/media.js';
import { adminRouter } from './routes/admin.js';
import { authLimiter } from './middleware/rateLimiter.js';

export const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());

// Production-grade CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin ${origin} not allowed`));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Register Domain Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/creators', creatorsRouter);
app.use('/api/collabs', collabsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/media', mediaRouter);
app.use('/api/admin', adminRouter);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 EVOC Creator Network API listening on http://0.0.0.0:${PORT}`);
});
