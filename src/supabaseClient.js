import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createMockQuery() {
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    or: () => query,
    in: () => query,
    range: () => query,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    order: () => query,
    limit: () => query,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve) => resolve({ data: [], error: null }),
  };

  return query;
}

const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
    signInWithPassword: async () => ({
      data: null,
      error: new Error('포트폴리오 데모는 admin/admin으로 로그인해주세요.'),
    }),
    signUp: async () => ({
      data: null,
      error: new Error('포트폴리오 데모에서는 회원가입을 지원하지 않습니다.'),
    }),
    signOut: async () => ({ error: null }),
  },
  from: () => createMockQuery(),
  rpc: async () => ({ data: null, error: null }),
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockSupabase;

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
