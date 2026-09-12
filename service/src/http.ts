export type ApiErrorCode = 'AUTH_REQUIRED' | 'AUTH_UNAVAILABLE' | 'NOT_FOUND' | 'INTERNAL_ERROR';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), {...init, headers});
}

export function requestId(request: Request): string {
  return request.headers.get('CF-Ray') ?? crypto.randomUUID();
}

export function error(code: ApiErrorCode, message: string, requestIdValue: string, status: number): Response {
  return json({error: {code, message}, requestId: requestIdValue}, {status});
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('Authorization');
  if (!value) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  return match?.[1] ?? null;
}
