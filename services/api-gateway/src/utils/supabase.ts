import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

export function getSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws as any,
    },
  });
}
