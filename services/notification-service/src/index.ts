/**
 * SHAHID Notification Service
 * Handles push (FCM), email, and in-app notification delivery.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

/**
 * POST /send
 * Send a notification via multiple channels.
 */
app.post('/send', async (req, res) => {
  try {
    const { user_id, type, channels, payload, project_id } = req.body;

    if (!user_id || !type || !channels || !payload) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Persist in-app notification
    const dbResult = await pool.query(
      `INSERT INTO notifications (user_id, type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, type, JSON.stringify(payload)]
    );

    // Send email if channel includes email
    if (channels.includes('email')) {
      const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [user_id]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        await smtp.sendMail({
          from: 'shahid@platform.local',
          to: user.email,
          subject: payload.title || 'SHAHID Notification',
          text: payload.body || '',
          html: payload.html || `<p>${payload.body}</p>`,
        });
        logger.info({ message: 'Email sent', userId: user_id, email: user.email });
      }
    }

    // Push notification (FCM) if channel includes push
    if (channels.includes('push')) {
      // In production: call FCM API with device tokens
      logger.info({ message: 'Push notification queued', userId: user_id, type });
    }

    res.status(200).json({ data: dbResult.rows[0], channels_sent: channels });
  } catch (err) {
    logger.error({ message: 'Send notification error', error: (err as Error).message });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.listen(PORT, () => {
  logger.info(`Notification Service running on port ${PORT}`);
});

// Worker: listen to notification events from Redis
async function notificationWorker() {
  while (true) {
    try {
      const eventData = await redis.brpop('notification:queue', 30);
      if (!eventData) continue;

      const event = JSON.parse(eventData[1]);
      logger.info({ message: 'Processing notification event', event });

      // Process and route to appropriate channels
    } catch (err) {
      logger.error({ message: 'Notification worker error', error: (err as Error).message });
    }
  }
}

notificationWorker().catch(console.error);
