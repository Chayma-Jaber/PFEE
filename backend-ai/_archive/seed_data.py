"""
Barsha E-Commerce - Database Seed Script
Populates the database with realistic demo data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
import random
import json

from app.core.database import SessionLocal, create_tables
from app.core.security import hash_password
from app.models.user import User, UserRole, Address
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus
from app.models.coupon import Coupon, CouponUsage, DiscountType
from app.models.return_request import ReturnRequest, ReturnStatus, ReturnReason

# Sample data
FIRST_NAMES = ["Ahmed", "Mohamed", "Fatma", "Amira", "Youssef", "Sana", "Karim", "Nour", "Omar", "Leila",
               "Amine", "Mariem", "Khaled", "Ines", "Houssem", "Rania", "Bilel", "Yasmine", "Fares", "Salma"]

LAST_NAMES = ["Ben Ali", "Trabelsi", "Bouazizi", "Gharbi", "Mejri", "Hammami", "Jebali", "Chaabane",
              "Mansouri", "Khelifi", "Saidi", "Bouzid", "Ferchichi", "Maalej", "Lahmar", "Dridi"]

CITIES = ["Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabes", "Ariana", "Gafsa", "Monastir", "Ben Arous",
          "La Marsa", "Hammamet", "Nabeul", "Djerba", "Mahdia"]

STREETS = ["Rue de la Liberte", "Avenue Habib Bourguiba", "Rue de France", "Avenue de Paris",
           "Rue Ibn Khaldoun", "Avenue de la Republique", "Rue Farhat Hached", "Avenue Mohamed V"]

def generate_phone():
    """Generate Tunisian phone number"""
    prefixes = ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
                "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
                "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"]
    return f"+216{random.choice(prefixes)}{random.randint(100, 999)}{random.randint(100, 999)}"

def generate_email(first_name, last_name):
    """Generate realistic email"""
    domains = ["gmail.com", "yahoo.fr", "hotmail.com", "outlook.com", "live.fr"]
    name_part = f"{first_name.lower()}.{last_name.lower().replace(' ', '')}".replace('à', 'a').replace('é', 'e')
    return f"{name_part}{random.randint(1, 99)}@{random.choice(domains)}"

def load_products():
    """Load products from catalog"""
    catalog_path = os.path.join(os.path.dirname(__file__), "data", "barsha_products.json")
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def seed_database():
    """Main seeding function"""
    print("=" * 60)
    print("  BARSHA E-COMMERCE - DATABASE SEEDING")
    print("=" * 60)

    # Create tables
    create_tables()

    db = SessionLocal()

    try:
        # Load products for orders
        products = load_products()
        print(f"\nLoaded {len(products)} products from catalog")

        # ============================================================
        # 1. CREATE CUSTOMERS
        # ============================================================
        print("\n[1/5] Creating customers...")
        customers = []

        for i in range(25):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)

            # Check if user exists
            email = generate_email(first_name, last_name)
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                customers.append(existing)
                continue

            user = User(
                email=email,
                phone=generate_phone(),
                password_hash=hash_password("Demo123!"),
                first_name=first_name,
                last_name=last_name,
                gender=random.choice(["homme", "femme"]),
                role=UserRole.CUSTOMER,
                is_active=True,
                is_verified=random.choice([True, True, True, False]),
                email_verified=random.choice([True, True, False]),
                newsletter_subscribed=random.choice([True, False]),
                login_count=random.randint(1, 50),
                last_login=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                created_at=datetime.utcnow() - timedelta(days=random.randint(30, 365))
            )
            db.add(user)
            db.flush()

            # Add address for each customer
            address = Address(
                user_id=user.id,
                label=random.choice(["Maison", "Bureau", "Domicile"]),
                first_name=first_name,
                last_name=last_name,
                phone=user.phone,
                street=f"{random.randint(1, 150)} {random.choice(STREETS)}",
                city=random.choice(CITIES),
                state=random.choice(CITIES),
                postal_code=str(random.randint(1000, 9999)),
                country="Tunisie",
                is_default=True,
                is_shipping=True
            )
            db.add(address)
            customers.append(user)

        db.commit()
        print(f"   Created {len(customers)} customers")

        # ============================================================
        # 2. CREATE COUPONS
        # ============================================================
        print("\n[2/5] Creating coupons...")
        coupons_data = [
            {"code": "WELCOME10", "name": "Bienvenue 10%", "discount": 10, "type": DiscountType.PERCENTAGE, "min_order": 50, "max_uses": 100},
            {"code": "SUMMER25", "name": "Soldes Ete 25%", "discount": 25, "type": DiscountType.PERCENTAGE, "min_order": 100, "max_uses": 50},
            {"code": "FLASH15", "name": "Vente Flash 15 TND", "discount": 15, "type": DiscountType.FIXED_AMOUNT, "min_order": 30, "max_uses": 200},
            {"code": "VIP20", "name": "Client VIP 20%", "discount": 20, "type": DiscountType.PERCENTAGE, "min_order": 150, "max_uses": 30},
            {"code": "FREESHIP", "name": "Livraison Gratuite", "discount": 7, "type": DiscountType.FREE_SHIPPING, "min_order": 80, "max_uses": 150},
            {"code": "BARSHA30", "name": "Super Promo 30%", "discount": 30, "type": DiscountType.PERCENTAGE, "min_order": 200, "max_uses": 20},
        ]

        coupons = []
        for c_data in coupons_data:
            existing = db.query(Coupon).filter(Coupon.code == c_data["code"]).first()
            if existing:
                coupons.append(existing)
                continue

            coupon = Coupon(
                code=c_data["code"],
                name=c_data["name"],
                description=f"Reduction de {c_data['discount']}{'%' if c_data['type'] == DiscountType.PERCENTAGE else ' TND'}",
                discount_type=c_data["type"],
                discount_value=c_data["discount"],
                minimum_order_amount=c_data["min_order"],
                usage_limit=c_data["max_uses"],
                usage_count=random.randint(0, c_data["max_uses"] // 2),
                is_active=True,
                starts_at=datetime.utcnow() - timedelta(days=30),
                expires_at=datetime.utcnow() + timedelta(days=60)
            )
            db.add(coupon)
            coupons.append(coupon)

        db.commit()
        print(f"   Created {len(coupons)} coupons")

        # ============================================================
        # 3. CREATE ORDERS
        # ============================================================
        print("\n[3/5] Creating orders...")
        orders = []
        order_statuses = [
            (OrderStatus.PENDING, 5),
            (OrderStatus.CONFIRMED, 4),
            (OrderStatus.PROCESSING, 6),
            (OrderStatus.SHIPPED, 8),
            (OrderStatus.DELIVERED, 20),
            (OrderStatus.CANCELLED, 3),
        ]

        order_num = 1000
        for status, count in order_statuses:
            for _ in range(count):
                if not customers:
                    continue

                customer = random.choice(customers)
                order_date = datetime.utcnow() - timedelta(days=random.randint(1, 90))

                # Select random products for this order
                num_items = random.randint(1, 4)
                order_products = random.sample(products, min(num_items, len(products))) if products else []

                # Calculate totals
                subtotal = 0
                items_data = []
                for prod in order_products:
                    qty = random.randint(1, 3)
                    price_str = str(prod.get("prix", "50")).replace(" TND", "").replace(",", ".").strip()
                    try:
                        price = float(price_str)
                    except:
                        price = 50.0
                    subtotal += price * qty
                    items_data.append({
                        "product_id": prod.get("id"),
                        "product_name": prod.get("nom", "Article"),
                        "product_image": prod.get("firstImg") or prod.get("image", ""),
                        "variant": random.choice(["M", "L", "XL", "S"]),
                        "quantity": qty,
                        "unit_price": price
                    })

                if not items_data:
                    # Create dummy item if no products
                    items_data.append({
                        "product_id": 1,
                        "product_name": "T-SHIRT",
                        "product_image": "",
                        "variant": "M",
                        "quantity": 1,
                        "unit_price": 35.9
                    })
                    subtotal = 35.9

                shipping = 7.0 if subtotal < 100 else 0
                discount = random.choice([0, 0, 0, 5, 10, 15])
                total = subtotal + shipping - discount

                order_num += 1
                order = Order(
                    reference=f"BRS-2024{order_num:04d}-{random.randint(1000,9999):04X}",
                    user_id=customer.id,
                    status=status,
                    payment_status=PaymentStatus.COMPLETED if status != OrderStatus.CANCELLED else PaymentStatus.REFUNDED,

                    # Amounts
                    subtotal=round(subtotal, 2),
                    shipping_amount=shipping,
                    discount_amount=discount,
                    tax_amount=0,
                    total_amount=round(total, 2),

                    # Shipping info
                    shipping_first_name=customer.first_name,
                    shipping_last_name=customer.last_name,
                    shipping_phone=customer.phone,
                    shipping_street=f"{random.randint(1, 150)} {random.choice(STREETS)}",
                    shipping_city=random.choice(CITIES),
                    shipping_postal_code=str(random.randint(1000, 9999)),
                    shipping_country="Tunisie",

                    # Customer info
                    customer_email=customer.email,
                    customer_phone=customer.phone,

                    # Payment
                    payment_method=random.choice(["ctp", "cod"]),
                    source="web",

                    # Timestamps
                    created_at=order_date,
                    updated_at=order_date + timedelta(hours=random.randint(1, 48))
                )

                if status == OrderStatus.DELIVERED:
                    order.delivered_at = order_date + timedelta(days=random.randint(2, 7))
                if status == OrderStatus.SHIPPED:
                    order.shipped_at = order_date + timedelta(days=random.randint(1, 3))
                    order.tracking_number = f"TN{random.randint(100000000, 999999999)}"

                db.add(order)
                db.flush()

                # Add order items
                for item_data in items_data:
                    item = OrderItem(
                        order_id=order.id,
                        product_id=item_data["product_id"],
                        sku=f"BRS-{item_data['product_id']}-{item_data['variant']}",
                        title=item_data["product_name"],
                        image_url=item_data["product_image"],
                        size=item_data["variant"],
                        color=random.choice(["Noir", "Blanc", "Bleu", "Rouge", "Vert", "Beige"]),
                        quantity=item_data["quantity"],
                        unit_price=item_data["unit_price"],
                        total_price=round(item_data["unit_price"] * item_data["quantity"], 2)
                    )
                    db.add(item)

                orders.append(order)

        db.commit()
        print(f"   Created {len(orders)} orders")

        # ============================================================
        # 4. CREATE RETURN REQUESTS
        # ============================================================
        print("\n[4/5] Creating return requests...")
        returns_created = 0

        # Get some delivered orders for returns
        delivered_orders = [o for o in orders if o.status == OrderStatus.DELIVERED]

        for i, order in enumerate(delivered_orders[:8]):
            return_ref = f"RET-2024-{1001 + i}"

            existing = db.query(ReturnRequest).filter(ReturnRequest.reference == return_ref).first()
            if existing:
                continue

            return_req = ReturnRequest(
                reference=return_ref,
                order_id=order.id,
                user_id=order.user_id,
                status=random.choice([
                    ReturnStatus.PENDING,
                    ReturnStatus.UNDER_REVIEW,
                    ReturnStatus.APPROVED,
                    ReturnStatus.REFUNDED,
                    ReturnStatus.COMPLETED
                ]),
                reason=random.choice(list(ReturnReason)),
                reason_details=random.choice([
                    "Taille incorrecte, je voudrais echanger",
                    "La couleur ne correspond pas a la photo",
                    "Article recu endommage",
                    "J'ai change d'avis",
                    "Ne correspond pas a mes attentes"
                ]),
                items=json.dumps([{"orderItemId": 1, "quantity": 1}]),
                refund_amount=round(order.total_amount * 0.8, 2),
                customer_notes="Merci de traiter ma demande rapidement",
                created_at=order.delivered_at + timedelta(days=random.randint(1, 10)) if order.delivered_at else datetime.utcnow()
            )
            db.add(return_req)
            returns_created += 1

        db.commit()
        print(f"   Created {returns_created} return requests")

        # ============================================================
        # 5. CREATE ADMIN AND STAFF USERS
        # ============================================================
        print("\n[5/5] Creating admin and staff users...")

        # Create Super Admin first
        admin_email = "admin@barsha.com.tn"
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if not existing_admin:
            admin_user = User(
                email=admin_email,
                phone="+21620000001",
                password_hash=hash_password("Admin123!"),
                first_name="Admin",
                last_name="Barsha",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
                email_verified=True,
                created_at=datetime.utcnow() - timedelta(days=365)
            )
            db.add(admin_user)
            db.commit()
            print("   Created Super Admin: admin@barsha.com.tn")

        # Create a demo customer for testing
        demo_email = "client@barsha.com.tn"
        existing_demo = db.query(User).filter(User.email == demo_email).first()
        if not existing_demo:
            demo_customer = User(
                email=demo_email,
                phone="+21650123456",
                password_hash=hash_password("Client123!"),
                first_name="Marie",
                last_name="Dupont",
                gender="femme",
                role=UserRole.CUSTOMER,
                is_active=True,
                is_verified=True,
                email_verified=True,
                newsletter_subscribed=True,
                login_count=15,
                last_login=datetime.utcnow() - timedelta(days=2),
                created_at=datetime.utcnow() - timedelta(days=120)
            )
            db.add(demo_customer)
            db.flush()

            # Add demo customer address
            demo_address = Address(
                user_id=demo_customer.id,
                label="Domicile",
                first_name="Marie",
                last_name="Dupont",
                phone="+21650123456",
                street="25 Avenue Habib Bourguiba",
                city="Tunis",
                state="Tunis",
                postal_code="1000",
                country="Tunisie",
                is_default=True,
                is_shipping=True
            )
            db.add(demo_address)
            db.commit()
            print("   Created Demo Customer: client@barsha.com.tn")

        staff_users = [
            {"email": "manager@barsha.com.tn", "first": "Sami", "last": "Benali", "role": UserRole.ADMIN},
            {"email": "catalog@barsha.com.tn", "first": "Rym", "last": "Trabelsi", "role": UserRole.CATALOG_MANAGER},
            {"email": "orders@barsha.com.tn", "first": "Nabil", "last": "Mejri", "role": UserRole.ORDER_MANAGER},
            {"email": "support@barsha.com.tn", "first": "Hana", "last": "Gharbi", "role": UserRole.SUPPORT_AGENT},
        ]

        staff_created = 0
        for staff in staff_users:
            existing = db.query(User).filter(User.email == staff["email"]).first()
            if existing:
                continue

            user = User(
                email=staff["email"],
                password_hash=hash_password("Staff123!"),
                first_name=staff["first"],
                last_name=staff["last"],
                role=staff["role"],
                is_active=True,
                is_verified=True,
                email_verified=True,
                created_at=datetime.utcnow() - timedelta(days=random.randint(60, 180))
            )
            db.add(user)
            staff_created += 1

        db.commit()
        print(f"   Created {staff_created} staff users")

        # ============================================================
        # SUMMARY
        # ============================================================
        print("\n" + "=" * 60)
        print("  SEEDING COMPLETE!")
        print("=" * 60)

        # Count totals
        total_users = db.query(User).count()
        total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
        total_orders = db.query(Order).count()
        total_coupons = db.query(Coupon).count()
        total_returns = db.query(ReturnRequest).count()

        print(f"""
Summary:
  - Total Users:     {total_users}
  - Customers:       {total_customers}
  - Staff:           {total_users - total_customers}
  - Orders:          {total_orders}
  - Coupons:         {total_coupons}
  - Return Requests: {total_returns}

============================================================
  TEST CREDENTIALS
============================================================

ADMIN BACK-OFFICE (http://localhost:4200/admin/login):
  - Email:    admin@barsha.com.tn
  - Password: Admin123!

CUSTOMER ACCOUNT (http://localhost:4200/compte):
  - Email:    client@barsha.com.tn
  - Password: Client123!

Staff Logins (password: Staff123!):
  - manager@barsha.com.tn (Admin)
  - catalog@barsha.com.tn (Catalog Manager)
  - orders@barsha.com.tn (Order Manager)
  - support@barsha.com.tn (Support Agent)

============================================================
  HOW TO RUN
============================================================
1. Start backend: cd backend-ai && python -m uvicorn app.main:app --reload --port 8000
2. Start frontend: ng serve
3. Access admin: http://localhost:4200/admin
4. Access shop: http://localhost:4200
""")

    except Exception as e:
        db.rollback()
        print(f"\nError during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
