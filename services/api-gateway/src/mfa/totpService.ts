/**
 * SHAHID MFA TOTP Service
 * Implements RFC 6238 / RFC 4226 compliant TOTP for Google Authenticator / Authy.
 *
 * SRS: FR-7.2 — Support multi-factor authentication (MFA) via TOTP for
 *      Tenant Admin and PM roles (Google Authenticator / Authy compatible)
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:9999';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey, { 
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as any }
});



const TOTP_SECRET_LENGTH = 20;
const TIME_STEP = 30;
const WINDOW_SIZE = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(): string {
  const bytes = crypto.randomBytes(TOTP_SECRET_LENGTH);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) secret += BASE32_ALPHABET[bytes[i] % 32];
  return secret;
}

export function generateTOTPURI(secret: string, accountName: string, issuer: string = 'SHAHID'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function generateTOTPCode(secret: string, counter: number): string {
  const secretBytes = Buffer.from(secret.match(/.{1}/g)?.map((c: string) => BASE32_ALPHABET.indexOf(c.toUpperCase()) * 5).flat() || []);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, '0');
}

export function getCurrentTOTPCode(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / TIME_STEP);
  return generateTOTPCode(secret, counter);
}

export function verifyTOTPCode(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / TIME_STEP);
  for (let i = -WINDOW_SIZE; i <= WINDOW_SIZE; i++) {
    if (generateTOTPCode(secret, counter + i) === code) return true;
  }
  return false;
}

export async function enableMFAForUser(userId: string, role: string): Promise<{ secret: string; qrCodeURI: string }> {
  const allowed = ['tenant_admin', 'project_manager', 'super_admin'];
  if (!allowed.includes(role)) throw new Error(`MFA only for roles: ${allowed.join(', ')}. Current: ${role}`);
  const secret = generateSecret();
  const { data: user, error: userError } = await supabase.from('users').select('email, name').eq('id', userId).single();
  if (userError || !user) throw new Error('User not found');
  const { error } = await supabase.from('users').update({ mfa_enabled: true, mfa_secret: secret, mfa_enabled_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw new Error(`Failed to enable MFA: ${error.message}`);
  logger.info({ message: 'MFA enabled for user', userId, role });
  return { secret, qrCodeURI: generateTOTPURI(secret, user.email, 'SHAHID') };
}

export async function verifyMFAForUser(userId: string, code: string): Promise<boolean> {
  const { data: user, error } = await supabase.from('users').select('mfa_enabled, mfa_secret, role').eq('id', userId).single();
  if (error || !user) throw new Error('User not found');
  if (!user.mfa_enabled) return true;
  if (!user.mfa_secret) throw new Error('MFA enabled but no secret found');
  const isValid = verifyTOTPCode(user.mfa_secret, code);
  logger.info({ message: isValid ? 'MFA verification successful' : 'MFA verification failed', userId, role: user.role });
  return isValid;
}

export async function disableMFAForUser(userId: string): Promise<void> {
  const { error } = await supabase.from('users').update({ mfa_enabled: false, mfa_secret: null, mfa_enabled_at: null }).eq('id', userId);
  if (error) throw new Error(`Failed to disable MFA: ${error.message}`);
  logger.info({ message: 'MFA disabled for user', userId });
}

export function isMFARequiredForRole(role: string): boolean {
  return ['tenant_admin', 'project_manager', 'super_admin'].includes(role);
}
