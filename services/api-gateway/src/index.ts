/**
 * SHAHID API Gateway
 * Entry point for all client requests. Handles auth, routing, rate limiting,
 * multi-tenant context injection, and request correlation tracing.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { correlationMiddleware } from './middleware/correlation';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { tenantContextMiddleware } from './middleware/tenantContext';
import { logger } from './utils/logger';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import zoneRoutes from './routes/zones';
import capturePointRoutes from './routes/capturePoints';
import photoRoutes from './routes/photos';
import reportRoutes from './routes/reports';
import snagRoutes from './routes/snags';
import notificationRoutes from './routes/notifications';
import evidenceRoutes from './routes/evidence';
import userRoutes from './routes/users';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

// Rate limiting: 100 req/min per user, 1000 per tenant
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-correlation-id'] as string || req.ip || 'unknown',
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Try again later.' });
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Correlation ID for tracing
app.use(correlationMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'shahid-api-gateway', version: '1.0.0' });
});

// Public routes (no auth)
app.use('/api/v1/auth', authRoutes);

// Protected routes
app.use(authMiddleware);
app.use(tenantContextMiddleware);

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/capture-points', capturePointRoutes);
app.use('/api/v1/photos', photoRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/snags', snagRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/evidence', evidenceRoutes);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`SHAHID API Gateway running on port ${PORT}`);
});

export default app;
