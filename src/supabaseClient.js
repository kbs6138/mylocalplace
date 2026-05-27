import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const missingSupabaseConfigError = new Error(
  'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building the app.'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, {
      get() {
        throw missingSupabaseConfigError;
      },
    });

/**
 * 정밀 위치 검증 및 캡슐 해제 RPC 호출
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {string} targetId 
 * @returns {Promise<any>}
 */
export async function verifyAndUnlock(latitude, longitude, targetId) {
  const { data, error } = await supabase.rpc('mlp_verify_and_unlock', {
    u_lat: latitude,
    u_lng: longitude,
    target_id: targetId
  });
  
  if (error) throw error;
  return data;
}
