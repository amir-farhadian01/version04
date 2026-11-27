// lib/corsOrigin.ts — shared CORS origin policy for the API and admin servers.
//
// Cookies are sent with credentials on every cross-origin API call, so
// reflecting an arbitrary Origin header is forbidden: any website could make
// the browser attach the user's session cookies to its requests. The policy:
//   - production (NODE_ENV=production or APP_ENV=production): ALLOWED_ORIGIN
//     MUST be an explicit, comma-separated list of absolute origins. When it
//     is missing or invalid the server fails closed — no
//     Access-Control-Allow-Origin header is ever emitted.
//   - development/test: when ALLOWED_ORIGIN is unset, only localhost origins
//     (http/https on localhost, 127.0.0.1, [::1], any port) are allowed so the
//     Vite dev server and admin SPA keep working without extra configuration.
//
// NOTE: scripts/validate-release-env.mjs duplicates the entry pattern below so
// release validation and the runtime policy stay aligned. Keep both in sync.

const ORIGIN_ENTRY_PATTERN = /^https?:\/\/[a-zA-Z0-9._-]+(?::\d{1,5})?$/;
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export type CorsOriginMode = 'deny-all' | 'localhost' | 'explicit';

export interface CorsOriginConfig {
  mode: CorsOriginMode;
  allowedOrigins: string[];
  invalidEntries: string[];
}

export function isProductionEnvironment(nodeEnv?: string, appEnv?: string): boolean {
  return nodeEnv === 'production' || appEnv === 'production';
}

export function resolveCorsOriginConfig(
  rawOrigin: string | undefined,
  isProduction: boolean,
): CorsOriginConfig {
  const entries = (rawOrigin ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    if (isProduction) {
      return { mode: 'deny-all', allowedOrigins: [], invalidEntries: [] };
    }
    return { mode: 'localhost', allowedOrigins: [], invalidEntries: [] };
  }

  const valid: string[] = [];
  const invalid: string[] = [];
  for (const entry of entries) {
    if (entry === 'true' || entry === '*' || !ORIGIN_ENTRY_PATTERN.test(entry)) {
      invalid.push(entry);
    } else {
      valid.push(entry);
    }
  }

  if (invalid.length > 0) {
    // One bad entry poisons the whole list: fail closed instead of silently
    // trusting the origins that happened to parse.
    if (isProduction) {
      return { mode: 'deny-all', allowedOrigins: [], invalidEntries: invalid };
    }
    return { mode: 'localhost', allowedOrigins: [], invalidEntries: invalid };
  }

  return { mode: 'explicit', allowedOrigins: valid, invalidEntries: [] };
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // A CORS origin never carries a path, query, hash, auth or trailing slash.
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      return false;
    }
    return LOCALHOST_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

export function createCorsOriginHandler(
  config: CorsOriginConfig,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  return (origin, callback) => {
    // Non-browser requests (curl, server-to-server, same-origin proxies) send
    // no Origin header; the cors middleware then emits no ACAO header anyway.
    if (!origin) {
      callback(null, true);
      return;
    }
    switch (config.mode) {
      case 'deny-all':
        callback(null, false);
        return;
      case 'localhost':
        callback(null, isLocalhostOrigin(origin));
        return;
      case 'explicit':
        callback(null, config.allowedOrigins.includes(origin));
        return;
    }
  };
}
