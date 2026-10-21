import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import { creatorsRouter } from './routes/creators.js';
import { collabsRouter } from './routes/collabs.js';
import { webhooksRouter } from './routes/webhooks.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Register Domain Routes
app.use('/api/creators', creatorsRouter);
app.use('/api/collabs', collabsRouter);
app.use('/api/webhooks', webhooksRouter);

app.listen(PORT, () => {
  console.log(`🚀 EVOC Creator Network API listening on http://localhost:${PORT}`);
});
