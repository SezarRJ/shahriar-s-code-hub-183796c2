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

import { correlationMiddleware } from './middleware/correlation';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { tenantContextMiddleware } from './middleware/tenantContext';
import { standardRateLimit, uploadRateLimit, authRateLimit } from './middleware/rateLimit';
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
import dashboardRoutes from './routes/dashboard';
import mfaRoutes from './routes/mfa';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));



app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Correlation ID for tracing
app.use(correlationMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'shahid-api-gateway', version: '1.0.0' });
});

// Public routes (no auth) — use auth rate limiter (stricter for login brute force)
app.use('/api/v1/auth', authRateLimit, authRoutes);

// Protected routes
app.use(authMiddleware);
app.use(tenantContextMiddleware);

// Data routes — standard rate limit (100 req/min per user, 1,000 per tenant)
app.use('/api/v1/users', standardRateLimit, userRoutes);
app.use('/api/v1/projects', standardRateLimit, projectRoutes);
app.use('/api/v1/zones', standardRateLimit, zoneRoutes);
app.use('/api/v1/capture-points', standardRateLimit, capturePointRoutes);
app.use('/api/v1/reports', standardRateLimit, reportRoutes);
app.use('/api/v1/snags', standardRateLimit, snagRoutes);
app.use('/api/v1/notifications', standardRateLimit, notificationRoutes);
app.use('/api/v1/evidence', standardRateLimit, evidenceRoutes);

app.use('/api/v1/dashboard', standardRateLimit, dashboardRoutes);
app.use('/api/v1/mfa', standardRateLimit, mfaRoutes);

// Upload routes — strict rate limit (10 uploads/min per user, 500 per tenant)
app.use('/api/v1/photos', uploadRateLimit, photoRoutes);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`SHAHID API Gateway running on port ${PORT}`);
});

export default app;
