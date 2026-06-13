import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';
import { enableMFAForUser, verifyMFAForUser, disableMFAForUser, isMFARequiredForRole } from '../mfa/totpService';

const router = Router();
const enableMFARequest = z.object({ user_id: z.string().uuid().optional() });
const verifyMFARequest = z.object({ user_id: z.string().uuid(), code: z.string().length(6).regex(/^\d{6}$/) });
const disableMFARequest = z.object({ user_id: z.string().uuid().optional(), confirmation_code: z.string().length(6).regex(/^\d{6}$/) });

router.post('/enable', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = enableMFARequest.parse(req.body);
    const targetUserId = parsed.user_id || context.user_id;
    const isAdmin = context.role === 'super_admin' || context.role === 'tenant_admin';
    if (parsed.user_id && !isAdmin) { res.status(403).json({ error: 'Only admins can enable MFA for other users' }); return; }
    if (targetUserId !== context.user_id && !isAdmin) { res.status(403).json({ error: 'Cannot enable MFA for another user' }); return; }

    const client = await getClientWithContext(context);
    const userResult = await client.query('SELECT id, role, mfa_enabled FROM users WHERE id = $1', [targetUserId]);
    client.release();

    if (userResult.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    const user = userResult.rows[0];
    if (!isMFARequiredForRole(user.role)) { res.status(400).json({ error: `MFA not required for role ${user.role}` }); return; }
    if (user.mfa_enabled) { res.status(400).json({ error: 'MFA already enabled' }); return; }

    const { secret, qrCodeURI } = await enableMFAForUser(targetUserId, user.role);
    const recoveryCode = require('crypto').randomBytes(16).toString('hex').toUpperCase();
    logger.info({ message: 'MFA enabled', userId: targetUserId, role: user.role, enabledBy: context.user_id });

    res.status(200).json({
      data: { user_id: targetUserId, mfa_enabled: true, qr_code_uri: qrCodeURI, recovery_code: recoveryCode, secret: secret, instructions: 'Scan the QR code with Google Authenticator, Authy, or Microsoft Authenticator. Save the recovery code in a secure location.' },
    });
  } catch (err) {
    logger.error({ message: 'Enable MFA error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const parsed = verifyMFARequest.parse(req.body);
    const isValid = await verifyMFAForUser(parsed.user_id, parsed.code);
    if (!isValid) { res.status(401).json({ error: 'Invalid TOTP code. Please check your authenticator app and try again.' }); return; }
    res.status(200).json({ data: { verified: true, user_id: parsed.user_id, timestamp: new Date().toISOString() } });
  } catch (err) {
    logger.error({ message: 'Verify MFA error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to verify MFA code' });
  }
});

router.post('/disable', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = disableMFARequest.parse(req.body);
    const targetUserId = parsed.user_id || context.user_id;
    const isAdmin = context.role === 'super_admin' || context.role === 'tenant_admin';
    if (parsed.user_id && !isAdmin) { res.status(403).json({ error: 'Only admins can disable MFA for other users' }); return; }
    const isValid = await verifyMFAForUser(targetUserId, parsed.confirmation_code);
    if (!isValid) { res.status(401).json({ error: 'Invalid TOTP confirmation code. MFA was not disabled.' }); return; }
    await disableMFAForUser(targetUserId);
    logger.info({ message: 'MFA disabled', userId: targetUserId, disabledBy: context.user_id });
    res.status(200).json({ data: { mfa_enabled: false, user_id: targetUserId, timestamp: new Date().toISOString() } });
  } catch (err) {
    logger.error({ message: 'Disable MFA error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

router.get('/status/:user_id', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const targetUserId = req.params.user_id;
    const isAdmin = context.role === 'super_admin' || context.role === 'tenant_admin';
    if (targetUserId !== context.user_id && !isAdmin) { res.status(403).json({ error: 'Cannot view MFA status for another user' }); return; }
    const client = await getClientWithContext(context);
    const userResult = await client.query('SELECT id, role, mfa_enabled, mfa_enabled_at FROM users WHERE id = $1', [targetUserId]);
    client.release();
    if (userResult.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    const user = userResult.rows[0];
    res.status(200).json({ data: { user_id: user.id, role: user.role, mfa_required: isMFARequiredForRole(user.role), mfa_enabled: user.mfa_enabled, mfa_enabled_at: user.mfa_enabled_at } });
  } catch (err) {
    logger.error({ message: 'MFA status error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

export default router;
