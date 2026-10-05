import { randomUUID, timingSafeEqual } from 'node:crypto';
import { access } from 'node:fs/promises';
import type { Express, NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type CheckName = 'database' | 'redis' | 'nats' | 'storage';
type CheckResult = { status: 'up' | 'down'; latencyMs: number; required: boolean };

interface ObservabilityDependencies {
  prisma: Pick<PrismaClient, '$queryRaw'>;
  pingRedis: () => Promise<boolean>;
  isNatsAvailable: () => boolean;
  storagePath: string;
  service: string;
  version: string;
  requiredServices?: CheckName[];
  metricsToken?: string;
  environment?: string;
  gitSha?: string;
}

interface MetricBucket {
  count: number;
  totalSeconds: number;
}

const PROCESS_STARTED_AT = Date.now();
const operationalCounters = new Map<string, number>();

const ALLOWED_OPERATIONAL_METRICS = new Set([
  'auth_failures_total',
  'database_failures_total',
  'job_failures_total',
  'nats_failures_total',
  'payment_failures_total',
  'payment_webhook_failures_total',
  'redis_failures_total',
]);

export function incrementOperationalMetric(name: string): void {
  if (!ALLOWED_OPERATIONAL_METRICS.has(name)) {
    throw new Error(`Unsupported operational metric: ${name}`);
  }
  operationalCounters.set(name, (operationalCounters.get(name) ?? 0) + 1);
}

function safeTokenMatches(expected: string, header: string | undefined): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const actual = header.slice('Bearer '.length);
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function statusClass(statusCode: number): string {
  return `${Math.floor(statusCode / 100)}xx`;
}

async function timedCheck(check: () => Promise<boolean>, required: boolean): Promise<CheckResult> {
  const startedAt = performance.now();
  try {
    const ok = await Promise.race([
      check(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000)),
    ]);
    return { status: ok ? 'up' : 'down', latencyMs: Math.round(performance.now() - startedAt), required };
  } catch {
    return { status: 'down', latencyMs: Math.round(performance.now() - startedAt), required };
  }
}

export function installObservability(app: Express, deps: ObservabilityDependencies): void {
  const required = new Set<CheckName>(deps.requiredServices ?? ['database', 'storage']);
  const requestMetrics = new Map<string, MetricBucket>();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    const startedAt = performance.now();
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationSeconds = (performance.now() - startedAt) / 1_000;
      const key = `${req.method}|${statusClass(res.statusCode)}`;
      const current = requestMetrics.get(key) ?? { count: 0, totalSeconds: 0 };
      current.count += 1;
      current.totalSeconds += durationSeconds;
      requestMetrics.set(key, current);

      const matchedRoute = req.route?.path
        ? `${req.baseUrl || ''}${String(req.route.path)}`
        : 'unmatched';
      const record = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : 'info',
        service: deps.service,
        requestId,
        method: req.method,
        route: matchedRoute,
        status: res.statusCode,
        latencyMs: Math.round(durationSeconds * 1_000),
      };
      const line = JSON.stringify(record);
      if (res.statusCode >= 500) console.error(line);
      else console.log(line);
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: deps.service,
      version: deps.version,
      environment: deps.environment || 'development',
      gitSha: deps.gitSha || 'unknown',
      uptimeSeconds: Math.floor((Date.now() - PROCESS_STARTED_AT) / 1_000),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      version: deps.version,
      environment: deps.environment || 'development',
      gitSha: deps.gitSha || 'unknown',
    });
  });

  app.get('/api/ready', async (_req, res) => {
    const checks: Record<CheckName, CheckResult> = {
      database: await timedCheck(async () => {
        const schema = await deps.prisma.$queryRaw<Array<{
          migrations: string | null;
          applicationSchema: string | null;
        }>>`
          SELECT
            to_regclass('public."_prisma_migrations"')::text AS migrations,
            to_regclass('public."User"')::text AS "applicationSchema"
        `;
        return Boolean(schema[0]?.migrations && schema[0]?.applicationSchema);
      }, required.has('database')),
      redis: await timedCheck(deps.pingRedis, required.has('redis')),
      nats: await timedCheck(async () => deps.isNatsAvailable(), required.has('nats')),
      storage: await timedCheck(async () => {
        await access(deps.storagePath);
        return true;
      }, required.has('storage')),
    };
    const unavailableRequired = Object.entries(checks)
      .filter(([, result]) => result.required && result.status === 'down')
      .map(([name]) => name);
    const unavailableOptional = Object.entries(checks)
      .filter(([, result]) => !result.required && result.status === 'down')
      .map(([name]) => name);
    const ready = unavailableRequired.length === 0;
    res.status(ready ? 200 : 503).json({
      status: ready ? (unavailableOptional.length ? 'degraded' : 'ready') : 'not_ready',
      checks,
      unavailableRequired,
      unavailableOptional,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/metrics', (req, res) => {
    if (deps.metricsToken && !safeTokenMatches(deps.metricsToken, req.header('authorization'))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (deps.environment === 'production' && !deps.metricsToken) {
      res.status(503).json({ error: 'Metrics endpoint is not configured' });
      return;
    }

    const lines = [
      '# HELP neighborly_process_uptime_seconds Process uptime in seconds.',
      '# TYPE neighborly_process_uptime_seconds gauge',
      `neighborly_process_uptime_seconds ${Math.floor((Date.now() - PROCESS_STARTED_AT) / 1_000)}`,
      '# HELP neighborly_http_requests_total HTTP responses by method and status class.',
      '# TYPE neighborly_http_requests_total counter',
      '# HELP neighborly_http_request_duration_seconds_sum Total HTTP response duration by method and status class.',
      '# TYPE neighborly_http_request_duration_seconds_sum counter',
    ];
    for (const [key, value] of [...requestMetrics.entries()].sort()) {
      const [method, status] = key.split('|');
      const labels = `{method="${method}",status="${status}"}`;
      lines.push(`neighborly_http_requests_total${labels} ${value.count}`);
      lines.push(`neighborly_http_request_duration_seconds_sum${labels} ${value.totalSeconds.toFixed(6)}`);
    }
    lines.push('# HELP neighborly_operational_events_total Operational failure events by bounded event name.');
    lines.push('# TYPE neighborly_operational_events_total counter');
    for (const [name, value] of [...operationalCounters.entries()].sort()) {
      lines.push(`neighborly_operational_events_total{event="${name}"} ${value}`);
    }
    res.type('text/plain; version=0.0.4').send(`${lines.join('\n')}\n`);
  });
}
