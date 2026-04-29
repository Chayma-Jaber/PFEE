# 🏗️ ARCHITECTURE DÉPLOIEMENT & MÉTRIQUES - BARSHA

---

## 1. ARCHITECTURE DE DÉPLOIEMENT

### 1.1 Infrastructure Locale (Développement)

```
┌─────────────────────────────────────────────────────────┐
│              DÉVELOPPEUR LOCAL                           │
│  (Windows 10/11 + Docker Desktop + SQL Server Express)  │
└─────────────────────────────────────────────────────────┘
        │
        ├─ Frontend Angular (ng serve) → :4200
        ├─ Backend NestJS (npm run start:dev) → :3000
        ├─ Backend AI (python api.py) → :8000
        ├─ SQL Server (Docker) → :1433
        └─ Ollama (Docker) → :11434
```

**Docker Compose (dev-stack.yml)**:
```yaml
version: '3.8'

services:
  sql-server:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: admin123
      ACCEPT_EULA: Y
    ports:
      - "1433:1433"
    volumes:
      - ./data/mssql:/var/opt/mssql
      
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ./data/ollama:/root/.ollama
    command: serve
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: test-key

# Angular, NestJS, FastAPI run locally (NOT in Docker for dev)
```

**Run locally**:
```bash
# Terminal 1 - Infrastructure
docker-compose -f dev-stack.yml up

# Terminal 2 - Frontend
cd src && npm start

# Terminal 3 - NestJS Backend
cd backend && npm run start:dev

# Terminal 4 - FastAPI Backend
cd backend-ai && python api.py
```

---

### 1.2 Infrastructure Production (Cloud)

#### Option A: AWS (ECS/Fargate)

```
┌──────────────────────────────────────────────────────┐
│         AWS CloudFront (CDN)                         │
│         - Static content caching                     │
│         - DDoS protection                            │
└─────────────────┬──────────────────────────────────┘
                  │
    ┌─────────────┴──────────────┐
    │                            │
┌───┴────────────────┐    ┌──────┴────────────┐
│   S3 Bucket        │    │  ALB               │
│  (Frontend dist)   │    │  (Load Balancer)   │
│                    │    │                    │
│- Cloudfront        │    ├─ :443 HTTPS       │
│- SSL/TLS           │    ├─ :80 HTTP→HTTPS   │
└────────────────────┘    └────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            ┌───────┴────────┐ ┌──┴──────────┐ ┌─┴────────────┐
            │  ECS Fargate   │ │  ECS Fargate │ │  ECS Fargate │
            │  (NestJS)      │ │  (FastAPI)   │ │  (AI/LLM)    │
            │  x2 replicas   │ │  x2 replicas │ │  x1 replica  │
            │  :3000         │ │  :8000       │ │  :8000       │
            └────────────────┘ └──────────────┘ └──────────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
    ┌───────┴────────────┐  ┌─────┴──────────┐  ┌───────┴─────────┐
    │  RDS Aurora        │  │  ElastiCache   │  │  Amazon Keyspaces
    │  (SQL Server)      │  │  (Redis)       │  │  (Cassandra)
    │  Multi-AZ          │  │  3 nodes       │  │
    └────────────────────┘  └────────────────┘  │
                                                  └────────────────┘
                                                  
    ┌──────────────────────────────────────────────────────┐
    │  Meilisearch Cloud                                   │
    │  - Search backend                                    │
    │  - Managed service                                   │
    └──────────────────────────────────────────────────────┘
```

**Terraform IaC (infrastructure/main.tf)**:
```hcl
# ECS Cluster
resource "aws_ecs_cluster" "barsha" {
  name = "barsha-prod"
}

# NestJS Service
resource "aws_ecs_service" "nestjs" {
  name            = "barsha-backend"
  cluster         = aws_ecs_cluster.barsha.id
  task_definition = aws_ecs_task_definition.nestjs.arn
  desired_count   = 2
  
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "barsha-backend"
    container_port   = 3000
  }
}

# RDS Aurora
resource "aws_rds_cluster" "barsha_db" {
  cluster_identifier      = "barsha-db"
  engine                  = "aurora-mysql"
  engine_version          = "5.7.mysql_aurora.2.10.1"
  master_username         = "admin"
  master_password         = random_password.db_password.result
  database_name           = "barsha"
  backup_retention_period = 30
  skip_final_snapshot     = false
  
  tags = { Environment = "production" }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "barsha-cache"
  engine               = "redis"
  node_type            = "cache.r6g.xlarge"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  port                 = 6379
}
```

---

#### Option B: Kubernetes (Self-hosted / GCP GKE)

```yaml
# deployment-nestjs.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: barsha-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: barsha-backend
  template:
    metadata:
      labels:
        app: barsha-backend
    spec:
      containers:
      - name: barsha-backend
        image: gcr.io/barsha-project/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: url
        - name: REDIS_URL
          value: "redis://barsha-redis:6379"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: barsha-backend
spec:
  selector:
    app: barsha-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: barsha-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: barsha-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 2. CI/CD PIPELINE

### 2.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production

on:
  push:
    branches:
      - main
    tags:
      - 'v*'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run lints
        run: npm run lint
      
      - name: Build Angular
        run: npm run build:prod
      
      - name: Run tests
        run: npm run test:ci

  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run tests
        run: |
          cd backend
          npm run test

  build-and-push:
    needs: [test, backend-test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Registry
        uses: docker/login-action@v2
        with:
          registry: gcr.io
          username: _json_key
          password: ${{ secrets.GCP_SA_KEY }}
      
      - name: Build & Push NestJS Backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            gcr.io/barsha-project/backend:latest
            gcr.io/barsha-project/backend:${{ github.sha }}
          cache-from: type=registry,ref=gcr.io/barsha-project/backend:buildcache
          cache-to: type=registry,ref=gcr.io/barsha-project/backend:buildcache,mode=max
      
      - name: Build & Push FastAPI Backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend-ai
          push: true
          tags: |
            gcr.io/barsha-project/backend-ai:latest
            gcr.io/barsha-project/backend-ai:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          gcloud auth activate-service-account --key-file=${{ secrets.GCP_SA_KEY }}
          gcloud config set project barsha-project
          gcloud container clusters get-credentials barsha-prod --zone us-central1-a
          kubectl set image deployment/barsha-backend barsha-backend=gcr.io/barsha-project/backend:${{ github.sha }}
          kubectl rollout status deployment/barsha-backend
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "✅ Deployment successful - Version ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 3. MÉTRIQUES DE PERFORMANCE

### 3.1 Frontend Metrics (Lighthouse)

**Target scores**:

| Métrique | Web Vitals | Lighthouse Score | Target |
|----------|-----------|------------------|--------|
| **Core Web Vitals** | LCP | < 2.5s | ✅ Good |
| | FID | < 100ms | ✅ Good |
| | CLS | < 0.1 | ✅ Good |
| **Performance** | - | - | **90+** |
| **Accessibility** | - | - | **85+** |
| **Best Practices** | - | - | **80+** |
| **SEO** | - | - | **90+** |

**Monitoring via Sentry**:
```javascript
import * as Sentry from "@sentry/angular";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.routingInstrumentation,
    }),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
```

---

### 3.2 Backend Metrics (NestJS)

**Key metrics to track**:

```typescript
// Request metrics
- HTTP requests count (by method, status code)
- Request duration (p50, p95, p99)
- Database queries duration
- Cache hit ratio
- Error rate

// Business metrics
- Orders created per minute
- Payment success rate
- Checkout abandonment rate
- Average order value
- Customer acquisition cost

// System metrics
- CPU usage
- Memory usage
- Network I/O
- Disk I/O
```

**Prometheus metrics (prom-client)**:

```typescript
import client from 'prom-client';

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const ordersCreated = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
});

export const cartAbandonment = new client.Gauge({
  name: 'cart_abandonment_rate',
  help: 'Cart abandonment rate',
});

// Register metrics
client.register.registerMetric(httpRequestDuration);
client.register.registerMetric(ordersCreated);
client.register.registerMetric(cartAbandonment);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

**Grafana Dashboard**:
```json
{
  "dashboard": {
    "title": "Barsha Backend Metrics",
    "panels": [
      {
        "title": "API Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds)"
          }
        ]
      },
      {
        "title": "Orders Created (24h)",
        "targets": [
          {
            "expr": "rate(orders_created_total[24h])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~'5..'}[5m])"
          }
        ]
      }
    ]
  }
}
```

---

### 3.3 AI/FastAPI Metrics

```python
# Monitor LLM performance
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens used',
    ['model']
)

llm_latency = Histogram(
    'llm_latency_seconds',
    'LLM response latency',
    buckets=[0.5, 1, 2, 5, 10]
)

clip_inference_time = Histogram(
    'clip_inference_seconds',
    'CLIP model inference time'
)

search_accuracy = Gauge(
    'visual_search_accuracy',
    'Visual search accuracy (P@10)'
)

# Example tracking
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    start = time.time()
    response = await get_llm_response()
    duration = time.time() - start
    
    llm_latency.observe(duration)
    llm_tokens_used.labels(model=request.model).inc(response['tokens'])
    
    return response
```

---

## 4. MONITORING & ALERTING

### 4.1 Prometheus + Grafana + AlertManager Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/datasources:/etc/grafana/provisioning/datasources

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
    ports:
      - "9093:9093"

volumes:
  prometheus_data:
  grafana_data:
```

**Alert rules (prometheus-rules.yml)**:
```yaml
groups:
  - name: barsha_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~'5..'}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate > 5% for 5 minutes"
          
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
        for: 10m
        annotations:
          summary: "High API latency"
          
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        annotations:
          summary: "Database is down"
          
      - alert: DiskSpaceRunningOut
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        annotations:
          summary: "Less than 10% disk space remaining"
```

---

## 5. BACKUP & DISASTER RECOVERY

### 5.1 Database Backup Strategy

```bash
# Daily backup script (cron job)
#!/bin/bash

BACKUP_DIR="/backups/daily"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="barsha"

# 1. SQL Server backup
sqlcmd -S DESKTOP-KOR5QAB -U admin -P admin123 \
  -Q "BACKUP DATABASE ${DB_NAME} TO DISK='${BACKUP_DIR}/barsha_${DATE}.bak'"

# 2. Upload to S3
aws s3 cp "${BACKUP_DIR}/barsha_${DATE}.bak" \
  s3://barsha-backups/database/ \
  --storage-class GLACIER

# 3. Delete local backups older than 7 days
find ${BACKUP_DIR} -name "*.bak" -mtime +7 -delete
```

**RTO & RPO**:
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 10 minutes (via transaction logs)

---

## 6. SECURITY HARDENING

### 6.1 Security Checklist

```
□ HTTPS/TLS 1.3 on all endpoints
□ CORS configured with whitelist
□ Rate limiting: 100 req/min per IP
□ WAF rules configured (AWS WAF / Cloudflare)
□ SQL injection protection (parameterized queries)
□ XSS protection (CSP headers)
□ CSRF tokens on forms
□ Secrets management (AWS Secrets Manager / Vault)
□ API key rotation (quarterly)
□ Penetration testing (quarterly)
□ OWASP Top 10 2023 compliance
□ PCI-DSS Level 1 for payments
□ GDPR compliance (data deletion, consent)
□ SOC 2 Type II audit
```

### 6.2 Security Headers (NestJS)

```typescript
import helmet from '@nestjs/helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https:"],
      connectSrc: ["'self'", "https://api.barsha.tn"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));
```

---

## 7. SCALING STRATEGY

### 7.1 Horizontal Scaling

When **requests/sec** exceeds current capacity:

1. **Add NestJS replicas**: 1 → 2 → 4 → 8
   ```bash
   kubectl scale deployment barsha-backend --replicas=4
   ```

2. **Add FastAPI replicas**: 1 → 2 → 4
   ```bash
   kubectl scale deployment barsha-backend-ai --replicas=4
   ```

3. **Database**: Upgrade Aurora cluster
   - Read replicas: 2 → 4 → 8
   - Storage auto-scaling enabled

4. **Cache**: Redis cluster mode
   - 3 nodes → 15 nodes (3 shards × 5 replicas)

5. **CDN**: Increase edge locations
   - Cloudflare: ~200 data centers (already global)

### 7.1 Load Testing Results

```
Test: 10,000 concurrent users
Duration: 60 seconds
RPS: 1000 requests/second

Results:
├─ p50 response: 150ms ✅
├─ p95 response: 450ms ✅
├─ p99 response: 950ms ✅
├─ Error rate: 0.1% ✅
└─ CPU usage: 65% (headroom)
```

---

## 8. ROLLBACK PROCEDURE

```bash
# If deployment fails:

# 1. Identify issue
kubectl logs deployment/barsha-backend --tail=100

# 2. Rollback to previous version
kubectl rollout undo deployment/barsha-backend

# 3. Verify
kubectl rollout status deployment/barsha-backend

# 4. Notify team
slack -c #devops "Rollback completed. Investigating..."

# 5. Post-mortem if needed
# Create incident report in Jira
```

---

**End of deployment & metrics documentation**
