import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { ObservabilityService } from './observability.service';

// Records request count, latency and errors per route. Also injects a correlation id
// into every request so downstream logs + events can be stitched together.
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly obs: ObservabilityService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    // Correlation id: honor existing header or generate
    const corrId = (req.headers['x-correlation-id'] as string) || randomUUID();
    req.correlationId = corrId;
    try { res.setHeader('x-correlation-id', corrId); } catch {}

    const start = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    const path = (req.route?.path || req.url || 'unknown').split('?')[0];
    const routeKey = `${method} ${path}`;

    this.obs.incCounter('http_requests_total');
    this.obs.incLabeled('http_by_method', method);

    return next.handle().pipe(
      tap(() => {
        const dur = Date.now() - start;
        this.obs.recordLatency(routeKey, dur);
        const status = res.statusCode || 200;
        this.obs.incLabeled('http_status', String(status));
        if (status >= 500) this.obs.incCounter('http_5xx_total');
        else if (status >= 400) this.obs.incCounter('http_4xx_total');
      }),
      catchError((err) => {
        const dur = Date.now() - start;
        this.obs.recordLatency(routeKey, dur);
        this.obs.recordError(
          { message: err?.message || String(err), stack: err?.stack },
          { route: routeKey, method, status: err?.status || 500 },
          corrId,
        );
        this.obs.incCounter('http_error_total');
        return throwError(() => err);
      }),
    );
  }
}
