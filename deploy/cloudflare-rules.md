# Cloudflare — cache rules for Barsha

Cloudflare sits in front of nginx. The nginx config already sets correct
`Cache-Control` headers; these rules pin the behavior on the CDN edge.

## 1. Page Rules (legacy UI) or Cache Rules (new UI)

| Priority | URL match | Action |
|---|---|---|
| 1 | `barsha.com.tn/api/*` | **Cache level: Bypass** |
| 2 | `barsha.com.tn/ai/*` | **Cache level: Bypass** |
| 3 | `barsha.com.tn/ngsw-worker.js` | **Bypass cache**, **Edge cache TTL: Respect origin** |
| 4 | `barsha.com.tn/ngsw.json` | **Bypass cache** |
| 5 | `barsha.com.tn/index.html` | **Edge cache TTL: 5 minutes**, **Browser cache TTL: Respect origin** |
| 6 | `barsha.com.tn/*.js` `*.css` `*.woff2` `*.png` `*.webp` `*.avif` `*.svg` | **Cache Everything**, **Edge cache TTL: 1 year** |

## 2. Transform Rules

Enable "Preserve Query String" on asset rules so hashed filenames (`main-ABC123.js`) are cached independently.

## 3. Cache Reserve

Enable Cache Reserve for media (`/uploads/*`, `/assets/images/*`) — large product images stay in edge cache for weeks.

## 4. Brotli + Auto Minify

- **Brotli:** On
- **Auto Minify:** leave OFF (Angular already minifies; double-minifying breaks source maps).

## 5. HTTPS + HSTS

- **Always Use HTTPS:** On
- **HSTS:** `max-age=31536000; includeSubDomains`
- **Min TLS Version:** 1.2

## 6. Verify after deploy

```bash
# Assets should have CF-Cache-Status: HIT after warm-up
curl -I https://barsha.com.tn/assets/logo.png | grep -i cache

# SW must NOT be cached by CF
curl -I https://barsha.com.tn/ngsw-worker.js | grep -i cache

# API must never be cached
curl -I https://barsha.com.tn/api/products | grep -i cache
```

Expected: HIT on assets, BYPASS/DYNAMIC on SW + API.
