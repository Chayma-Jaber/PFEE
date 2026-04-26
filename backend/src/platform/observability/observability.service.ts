import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

// Lightweight in-process metrics + error sink. Exposes a Prometheus text endpoint so
// external scraping can plug in later; meanwhile an admin page reads these snapshots.

interface CounterMap { [name: string]: number; }
interface HistogramBucket { count: number; sumMs: number; p50: number; p95: number; p99: number; }
interface ErrorEntry {
  id: string;
  at: string;
  message: string;
  stack: string | null;
  correlationId: string | null;
  context: Record<string, any> | null;
}

const P95_WINDOW = 2048; // rolling window for p95/p99

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('Observability');

  private counters: CounterMap = {};
  private labeledCounters: Map<string, Map<string, number>> = new Map();
  private latencyByRoute: Map<string, number[]> = new Map();
  private recentErrors: ErrorEntry[] = [];
  private startedAt = new Date();

  incCounter(name: string, amount = 1) {
    this.counters[name] = (this.counters[name] || 0) + amount;
  }

  incLabeled(name: string, label: string, amount = 1) {
    if (!this.labeledCounters.has(name)) this.labeledCounters.set(name, new Map());
    const m = this.labeledCounters.get(name)!;
    m.set(label, (m.get(label) || 0) + amount);
  }

  recordLatency(route: string, ms: number) {
    if (!this.latencyByRoute.has(route)) this.latencyByRoute.set(route, []);
    const buf = this.latencyByRoute.get(route)!;
    buf.push(ms);
    if (buf.length > P95_WINDOW) buf.splice(0, buf.length - P95_WINDOW);
  }

  recordError(err: { message: string; stack?: string }, context?: Record<string, any>, correlationId?: string) {
    const entry: ErrorEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      message: (err.message || 'unknown').slice(0, 500),
      stack: err.stack ? err.stack.split('\n').slice(0, 10).join('\n') : null,
      correlationId: correlationId || null,
      context: context || null,
    };
    this.recentErrors.unshift(entry);
    if (this.recentErrors.length > 200) this.recentErrors.length = 200;
    this.incCounter('errors_total');
  }

  private histogram(buf: number[]): HistogramBucket {
    if (buf.length === 0) return { count: 0, sumMs: 0, p50: 0, p95: 0, p99: 0 };
    const sorted = [...buf].sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return {
      count: buf.length,
      sumMs: buf.reduce((s, x) => s + x, 0),
      p50: Math.round(pct(0.5)),
      p95: Math.round(pct(0.95)),
      p99: Math.round(pct(0.99)),
    };
  }

  snapshot() {
    const routes: Record<string, HistogramBucket> = {};
    for (const [route, buf] of this.latencyByRoute.entries()) {
      routes[route] = this.histogram(buf);
    }
    const labeled: Record<string, Record<string, number>> = {};
    for (const [name, map] of this.labeledCounters.entries()) {
      labeled[name] = Object.fromEntries(map);
    }
    return {
      uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      counters: this.counters,
      labeled,
      routes,
      recentErrors: this.recentErrors.slice(0, 50),
      errorRate1h: this.counters['errors_total'] || 0, // simplification: total since boot
    };
  }

  recentErrorsList(limit = 100) {
    return this.recentErrors.slice(0, Math.min(200, limit));
  }

  // Prometheus text format (scrapeable)
  prometheusText(): string {
    const lines: string[] = [];
    lines.push(`# HELP barsha_uptime_seconds Seconds since the Node process started`);
    lines.push(`# TYPE barsha_uptime_seconds gauge`);
    lines.push(`barsha_uptime_seconds ${Math.floor((Date.now() - this.startedAt.getTime()) / 1000)}`);

    for (const [name, value] of Object.entries(this.counters)) {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# TYPE barsha_${safeName} counter`);
      lines.push(`barsha_${safeName} ${value}`);
    }

    for (const [name, map] of this.labeledCounters.entries()) {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# TYPE barsha_${safeName} counter`);
      for (const [lbl, v] of map.entries()) {
        const safeLbl = lbl.replace(/["\\]/g, '_').slice(0, 60);
        lines.push(`barsha_${safeName}{label="${safeLbl}"} ${v}`);
      }
    }

    for (const [route, buf] of this.latencyByRoute.entries()) {
      const h = this.histogram(buf);
      const safe = route.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 80);
      lines.push(`# TYPE barsha_http_latency_p95_ms{route="${route}"} gauge`);
      lines.push(`barsha_http_latency_p95_ms{route="${safe}"} ${h.p95}`);
      lines.push(`barsha_http_latency_p99_ms{route="${safe}"} ${h.p99}`);
      lines.push(`barsha_http_request_count{route="${safe}"} ${h.count}`);
    }

    return lines.join('\n') + '\n';
  }
}
