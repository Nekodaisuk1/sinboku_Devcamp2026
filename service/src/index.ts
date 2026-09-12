import {bearerToken, error, json, requestId} from './http';

export interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

type SupabaseUser = {id: string; email?: string; role?: string};

function config(env: Env): {configured: boolean; url?: string; anonKey?: string} {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return {configured: false};
  return {configured: true, url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY};
}

async function currentUser(request: Request, env: Env): Promise<Response> {
  const id = requestId(request);
  const token = bearerToken(request);
  if (!token) return error('AUTH_REQUIRED', 'サインインが必要です。', id, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return error('AUTH_UNAVAILABLE', '認証サービスがまだ設定されていません。', id, 503);
  }

  let response: Response;
  try {
    response = await fetch(new URL('/auth/v1/user', env.SUPABASE_URL), {
      headers: {apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`}
    });
  } catch (cause) {
    console.error(JSON.stringify({event: 'auth_lookup_failed', requestId: id, cause: String(cause)}));
    return error('AUTH_UNAVAILABLE', '認証サービスに接続できませんでした。', id, 503);
  }
  if (!response.ok) return error('AUTH_REQUIRED', 'セッションの有効期限が切れました。', id, 401);
  const user = await response.json() as SupabaseUser;
  return json({data: {id: user.id, email: user.email ?? null, role: user.role ?? 'authenticated'}, requestId: id});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/health' && request.method === 'GET') {
      return json({data: {status: 'ok'}, requestId: requestId(request)});
    }
    if (url.pathname === '/api/v1/config' && request.method === 'GET') {
      return json({data: config(env), requestId: requestId(request)});
    }
    if (url.pathname === '/api/v1/me' && request.method === 'GET') return currentUser(request, env);
    if (url.pathname.startsWith('/api/')) return error('NOT_FOUND', 'APIが見つかりません。', requestId(request), 404);
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
