# -*- coding: utf-8 -*-
"""End-to-end smoke test against the live backend on :8000."""
import json, sys, urllib.request, urllib.error, urllib.parse, time, traceback

BASE = "http://localhost:8000"
results = []

def req(method, path, data=None, token=None, expect=None, label=None):
    name = label or f"{method} {path}"
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if token: headers["Authorization"] = f"Bearer {token}"
    req_obj = urllib.request.Request(url, data=body, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req_obj, timeout=15) as r:
            code = r.getcode()
            body_text = r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        code = e.code
        body_text = e.read().decode("utf-8", errors="replace")
    except Exception as e:
        code = 0
        body_text = f"EXC {type(e).__name__}: {e}"
    elapsed = int((time.time()-t0)*1000)
    ok = (expect is None and 200 <= code < 300) or (expect == code)
    short = body_text[:120].replace("\n", " ")
    results.append((name, code, ok, short, elapsed))
    sym = "OK" if ok else "FAIL"
    print(f"[{sym:4}] {code:3} {elapsed:4}ms {name:60s} {short}")
    try:
        return json.loads(body_text)
    except Exception:
        return None

# ============================================================================
# PUBLIC / STOREFRONT
# ============================================================================
print("\n=== PUBLIC / STOREFRONT ===")
req("GET", "/health")
req("GET", "/api/categories")
req("GET", "/api/products?limit=2")
req("GET", "/api/products/1")
req("POST", "/indexes/products/search", {"q":"","limit":2})
req("GET", "/api/help/categories")
req("GET", "/api/help/featured?limit=3")
req("GET", "/api/recommendations/v3/trending?limit=3")
req("GET", "/api/recommendations/v3/new-arrivals?limit=3")
req("GET", "/api/bundles?limit=3")
req("GET", "/api/bundles/featured?limit=3")

# ============================================================================
# AUTH FLOW
# ============================================================================
print("\n=== AUTH ===")
admin = req("POST", "/api/auth/login", {"email":"admin@barsha.com.tn","password":"Admin123!"}, label="POST /api/auth/login (admin)")
admin_token = admin["tokens"]["access_token"] if admin and "tokens" in admin else None

# create new customer & login
import random
suffix = random.randint(10000, 99999)
test_email = f"smoketest+{suffix}@barsha.test"
reg = req("POST", "/api/auth/register", {
    "email": test_email,
    "password": "TestPass123!",
    "first_name": "Smoke",
    "last_name": "Test",
    "phone": f"+216220{suffix}",
}, label="POST /api/auth/register")
cust_token = (reg or {}).get("tokens", {}).get("access_token") or (reg or {}).get("access_token")
if not cust_token:
    # try login if register conflicts
    cust = req("POST", "/api/auth/login", {"email": test_email, "password":"TestPass123!"}, label="POST /api/auth/login (customer)")
    cust_token = (cust or {}).get("tokens", {}).get("access_token")
print(f"   admin_token={'yes' if admin_token else 'no'}, cust_token={'yes' if cust_token else 'no'}")

# ============================================================================
# CUSTOMER FLOW (with cust_token)
# ============================================================================
print("\n=== CUSTOMER ===")
req("GET", "/api/auth/me", token=cust_token)
req("GET", "/api/users/me", token=cust_token, label="GET /api/users/me")
me = req("GET", "/api/auth/me", token=cust_token)
req("GET", "/api/cart", token=cust_token)
# add to cart
req("POST", "/api/cart/items", {"product_id": 1, "quantity": 1}, token=cust_token)
cart = req("GET", "/api/cart", token=cust_token)
req("GET", "/api/wishlist", token=cust_token)
req("GET", "/api/getWishListItems", token=cust_token, label="GET /api/getWishListItems (legacy)")
req("GET", "/api/getOrders", token=cust_token, label="GET /api/getOrders (legacy)")
req("GET", "/api/orders/me", token=cust_token, label="GET /api/orders/me")
req("GET", "/api/loyalty/account", token=cust_token)
req("GET", "/api/notifications", token=cust_token)
req("GET", "/api/storefront/gdpr/requests/mine", token=cust_token)
req("GET", "/api/referrals/my-code", token=cust_token)

# ============================================================================
# CHATBOT / AI
# ============================================================================
print("\n=== AI ===")
req("POST", "/api/ai/chat", {"message":"Bonjour", "history":[]}, token=cust_token, label="POST /api/ai/chat")
req("POST", "/api/ai/like-this", {"image_url":"https://barsha.com.tn/test.jpg"}, token=cust_token, label="POST /api/ai/like-this")

# ============================================================================
# ADMIN ENDPOINTS (require admin token)
# ============================================================================
print("\n=== ADMIN ===")
req("GET", "/api/admin/dashboard/stats", token=admin_token)
req("GET", "/api/admin/orders", token=admin_token)
req("GET", "/api/admin/products?limit=3", token=admin_token)
req("GET", "/api/admin/customers?limit=3", token=admin_token)
req("GET", "/api/admin/coupons", token=admin_token)
req("GET", "/api/admin/returns", token=admin_token)
req("GET", "/api/admin/marketplace/sellers", token=admin_token)
req("GET", "/api/admin/marketplace/payouts", token=admin_token)
req("GET", "/api/admin/marketplace/stats", token=admin_token)
req("GET", "/api/admin/warehouses", token=admin_token)
req("GET", "/api/admin/warehouses/stats", token=admin_token)
req("GET", "/api/admin/lifecycle/sequences", token=admin_token)
req("GET", "/api/admin/lifecycle/stats", token=admin_token)
req("GET", "/api/admin/fiscal/receipts", token=admin_token)
req("GET", "/api/admin/fiscal/stats", token=admin_token)
req("GET", "/api/admin/fiscal/vat-report", token=admin_token)
req("GET", "/api/admin/gdpr/requests", token=admin_token)
req("GET", "/api/admin/gdpr/stats", token=admin_token)
req("GET", "/api/admin/fraud/queue", token=admin_token)
req("GET", "/api/admin/fraud/stats", token=admin_token)
req("GET", "/api/admin/dynamic-pricing/rules", token=admin_token)
req("GET", "/api/admin/b2b/accounts", token=admin_token)
req("GET", "/api/admin/b2b/stats", token=admin_token)
req("GET", "/api/admin/preorder/drops", token=admin_token)
req("GET", "/api/admin/preorder/stats", token=admin_token)
req("GET", "/api/admin/configurator", token=admin_token)
req("GET", "/api/admin/replenishment/suppliers", token=admin_token)
req("GET", "/api/admin/replenishment/purchase-orders", token=admin_token)
req("GET", "/api/admin/feature-flags", token=admin_token)
req("GET", "/api/admin/cms/pages", token=admin_token)
req("GET", "/api/admin/lifecycle/process-due", token=admin_token, label="POST trigger (using GET first)")
req("GET", "/api/admin/email-analytics/stats", token=admin_token)
req("GET", "/api/admin/sms/stats", token=admin_token)
req("GET", "/api/admin/erp/invoices", token=admin_token)
req("GET", "/api/admin/ugc-moderation/queue", token=admin_token)
req("GET", "/api/admin/ugc-moderation/stats", token=admin_token)
req("GET", "/api/admin/propensity/at-risk", token=admin_token)
req("GET", "/api/admin/support/tickets", token=admin_token)
req("GET", "/api/admin/faq/categories", token=admin_token)
req("GET", "/api/admin/faq/faqs", token=admin_token)
req("GET", "/api/admin/reviews", token=admin_token)
req("GET", "/api/admin/loyalty/accounts", token=admin_token)
req("GET", "/api/admin/notifications", token=admin_token)
req("GET", "/api/admin/bundles", token=admin_token)
req("GET", "/api/admin/wave3/stats", token=admin_token)
req("GET", "/api/admin/wave4/customers/segments", token=admin_token)
req("GET", "/api/admin/wave4/tasks", token=admin_token)

# ============================================================================
# SUMMARY
# ============================================================================
print("\n=== SUMMARY ===")
total = len(results)
passes = sum(1 for r in results if r[2])
fails = [r for r in results if not r[2]]
print(f"Total: {total} | OK: {passes} | FAIL: {total-passes}")
print(f"\nFailures:")
for n, code, ok, body, ms in fails:
    print(f"  {code:3} {n:60s} {body}")
