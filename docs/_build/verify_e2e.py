# -*- coding: utf-8 -*-
"""End-to-end customer + admin flow tests against live backend."""
import json, urllib.request, urllib.error, time, random

BASE = "http://localhost:8000"
results = []

def req(method, path, data=None, token=None, label=None):
    name = label or f"{method} {path}"
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            code, body_text = resp.getcode(), resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        code, body_text = e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        code, body_text = 0, f"EXC {type(e).__name__}: {e}"
    elapsed = int((time.time()-t0)*1000)
    ok = 200 <= code < 300
    short = body_text[:160].replace("\n", " ")
    results.append((name, code, ok, short, elapsed))
    sym = "OK  " if ok else "FAIL"
    print(f"[{sym}] {code:3} {elapsed:5}ms {name:60s} {short}")
    try:
        return json.loads(body_text)
    except Exception:
        return body_text

# ============================================================================
# 1. CUSTOMER E2E: signup → login → wishlist → place order
# ============================================================================
print("\n=== CUSTOMER E2E ===")
suffix = random.randint(10000, 99999)
email = f"e2e+{suffix}@barsha.test"
phone = f"+216220{suffix}"

reg = req("POST", "/api/auth/register", {
    "email": email, "password": "TestPass123!",
    "first_name": "E2E", "last_name": "Test", "phone": phone,
}, label="register customer")
ct = (reg or {}).get("tokens", {}).get("access_token")

# Verify "users/me" alias works
req("GET", "/api/users/me", token=ct, label="GET /api/users/me (alias)")

# Wishlist tests (the FIX target)
req("POST", "/api/addWishListItem", {"idProduct": 1}, token=ct, label="POST /api/addWishListItem (fixed)")
wl = req("GET", "/api/getWishListItems", token=ct, label="GET /api/getWishListItems (fixed)")
print(f"   wishlist contains {len(wl.get('items', []))} item(s)" if isinstance(wl, dict) else f"   wishlist={wl}")

# Address creation
addr = req("POST", "/api/createAddress", {
    "label": "Domicile", "first_name": "E2E", "last_name": "Test",
    "phone": phone, "street": "Av. Habib Bourguiba", "city": "Tunis",
    "postal_code": "1001", "country": "TN", "is_default": True,
}, token=ct, label="POST /api/createAddress")
addr_id = (addr or {}).get("id")
print(f"   address id = {addr_id}")

# Get a product with stock to put in cart
prods = req("GET", "/api/products?limit=1", label="GET /api/products?limit=1")
sample_product = (prods or {}).get("items", [{}])[0] if prods else {}
sample_ean = sample_product.get("ean13") or sample_product.get("sku")
sample_price = sample_product.get("currentPrice") or sample_product.get("price") or 50
sample_id = sample_product.get("id")
print(f"   product id={sample_id}, sku={sample_ean}, price={sample_price}")

# checkStock (used in cart pre-checkout)
req("POST", "/api/checkStock", {"ean13": sample_ean, "quantity": 1}, token=ct, label="POST /api/checkStock")

# checkCartProducts (verify cart items before checkout)
req("POST", "/api/checkCartProducts", [{"ean13": sample_ean, "quantity": 1}], token=ct, label="POST /api/checkCartProducts")

# THE BIG ONE: place an order via the legacy adapter
order_payload = {
    "orderData": {
        "subTotal": float(sample_price),
        "shippingMethod": 1,         # home delivery
        "paymentMethod": 3,          # COD
        "shippingCost": 7.0,
        "total": float(sample_price) + 7.0,
        "shippingAddress": addr_id,
    },
    "products": [{
        "ean13": sample_ean,
        "quantity": 1,
        "unitPrice": float(sample_price),
        "discount": 0,
        "discountDesc": "",
    }],
}
order_resp = req("POST", "/api/placeOrder", order_payload, token=ct, label="POST /api/placeOrder (legacy)")
order_id = ((order_resp or {}).get("data") or {}).get("id")
order_ref = ((order_resp or {}).get("data") or {}).get("reference")
print(f"   order placed: id={order_id}, ref={order_ref}")

# Verify order shows up in user's history
my_orders = req("GET", "/api/getOrders", token=ct, label="GET /api/getOrders")
print(f"   my orders: {len(my_orders) if isinstance(my_orders, list) else 'n/a'}")
if order_id:
    req("GET", f"/api/getOrderById/{order_id}", token=ct, label="GET /api/getOrderById/:id")

# Cleanup wishlist — use the actual product id we added (1)
# The endpoint takes the product id, not the row id.
wl2 = wl if isinstance(wl, dict) else {}
items_arr = wl2.get("items", []) if isinstance(wl2, dict) else []
if items_arr:
    pid_to_remove = items_arr[0].get("product_id", 1)
    req("DELETE", f"/api/removeWishListItem/{pid_to_remove}", token=ct, label="DELETE /api/removeWishListItem/:productId")

# ============================================================================
# 2. ADMIN CRUD
# ============================================================================
print("\n=== ADMIN CRUD ===")
admin = req("POST", "/api/auth/login",
    {"email": "admin@barsha.com.tn", "password": "Admin123!"}, label="admin login")
at = (admin or {}).get("tokens", {}).get("access_token")

# Create a category
new_cat = req("POST", "/api/admin/categories", {
    "name": f"E2E Test Cat {suffix}", "slug": f"e2e-cat-{suffix}", "description": "test"
}, token=at, label="POST /api/admin/categories")
cat_id = (new_cat or {}).get("id")
print(f"   created category id={cat_id}")
if cat_id:
    req("PUT", f"/api/admin/categories/{cat_id}", {"description": "updated"}, token=at, label="PUT /api/admin/categories/:id")
    req("DELETE", f"/api/admin/categories/{cat_id}", token=at, label="DELETE /api/admin/categories/:id")

# Create coupon (admin endpoint expects type/value, not discount_type/discount_value)
new_coup = req("POST", "/api/admin/coupons", {
    "code": f"E2E{suffix}",
    "description": "Test coupon",
    "type": "PERCENTAGE",
    "value": 10,
    "is_active": True,
}, token=at, label="POST /api/admin/coupons")
coup_id = (new_coup or {}).get("id")
if coup_id:
    req("DELETE", f"/api/admin/coupons/{coup_id}", token=at, label="DELETE /api/admin/coupons/:id")

# Marketplace seller approve flow (no seller exists, should be empty queue)
sellers = req("GET", "/api/admin/marketplace/sellers", token=at, label="GET /api/admin/marketplace/sellers")

# Lifecycle sequence creation
new_seq = req("POST", "/api/admin/lifecycle/sequences", {
    "name": f"E2E seq {suffix}",
    "trigger_event": "user.registered",
    "description": "test",
    "is_active": True,
    "steps": [{"delayHours": 0, "channel": "EMAIL", "subject": "Bienvenue", "body": "Hello {{firstName}}"}]
}, token=at, label="POST /api/admin/lifecycle/sequences")
seq_id = (new_seq or {}).get("id")
if seq_id:
    req("DELETE", f"/api/admin/lifecycle/sequences/{seq_id}", token=at, label="DELETE /api/admin/lifecycle/sequences/:id")

# Warehouse: create + update (no DELETE — by design, sellers/warehouses are deactivated, not deleted)
new_wh = req("POST", "/api/admin/warehouses", {
    "code": f"E2E{suffix}", "name": f"E2E Test {suffix}", "city": "Test City"
}, token=at, label="POST /api/admin/warehouses")
wh_id = (new_wh or {}).get("id")
print(f"   warehouse id={wh_id}")
if wh_id:
    req("PUT", f"/api/admin/warehouses/{wh_id}", {"is_active": False}, token=at, label="PUT /api/admin/warehouses/:id (deactivate)")

# Bundle
new_bundle = req("POST", "/api/admin/bundles", {
    "name": f"E2E Bundle {suffix}",
    "bundlePrice": 99,
    "originalPrice": 150,
    "isActive": True,
    "products": [{"productId": 1, "quantity": 1}],
}, token=at, label="POST /api/admin/bundles")
b_id = (new_bundle or {}).get("id")
if b_id:
    req("DELETE", f"/api/admin/bundles/{b_id}", token=at, label="DELETE /api/admin/bundles/:id")

# ============================================================================
# 3. SELLER APPLY FLOW
# ============================================================================
print("\n=== SELLER ===")
# Apply via storefront — backend expects camelCase: businessName, contactEmail
apply = req("POST", "/api/storefront/seller/apply", {
    "businessName": f"Test Seller {suffix}",
    "legalName": f"Test Seller LLC {suffix}",
    "contactEmail": email,
    "contactPhone": phone,
    "vatNumber": f"VAT{suffix}",
}, token=ct, label="POST /api/storefront/seller/apply")
seller_id = (apply or {}).get("id")
print(f"   seller application id={seller_id}")

# Admin approves
if seller_id:
    appr = req("POST", f"/api/admin/marketplace/sellers/{seller_id}/approve",
               {"commissionPct": 10}, token=at,
                label="POST /api/admin/marketplace/sellers/:id/approve")

# Seller's own data
me_seller = req("GET", "/api/storefront/seller/me", token=ct, label="GET /api/storefront/seller/me")
my_payouts = req("GET", "/api/storefront/seller/me/payouts", token=ct, label="GET /api/storefront/seller/me/payouts")
seller_catalog = req("GET", "/api/storefront/seller/catalog/products", token=ct, label="GET /api/storefront/seller/catalog/products")
seller_orders = req("GET", "/api/storefront/seller/catalog/orders", token=ct, label="GET /api/storefront/seller/catalog/orders")

# ============================================================================
# SUMMARY
# ============================================================================
total = len(results)
passes = sum(1 for r in results if r[2])
fails = [r for r in results if not r[2]]
print(f"\n=== SUMMARY ===")
print(f"Total: {total} | OK: {passes} | FAIL: {len(fails)}")
if fails:
    print(f"\nFailures:")
    for n, code, ok, body, ms in fails:
        print(f"  {code:3} {n:60s} {body}")
