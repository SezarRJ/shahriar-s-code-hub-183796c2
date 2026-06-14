import { Router, Request, Response } from 'express';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { unread_only = 'false', limit = '50' } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: any[] = [context.user_id];

    if (unread_only === 'true') {
      query += ' AND read_at IS NULL';
    }

    params.push(parseInt(limit as string, 10));
    query += ' ORDER BY created_at DESC LIMIT $' + params.length;

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch notifications error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query(
      'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, context.user_id]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Mark notification read error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

export default router;
