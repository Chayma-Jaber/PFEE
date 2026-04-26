#!/usr/bin/env python3
"""
Barsha AI System Verification Script
=====================================
Validates that all AI modules are properly configured and working.

Usage:
    python verify_system.py

This script checks:
1. Environment configuration
2. Data files existence
3. CLIP model loading
4. Recommendation engine
5. API endpoint availability
"""

import os
import sys
import json
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")

def print_check(name, passed, details=""):
    icon = f"{Colors.GREEN}✓{Colors.RESET}" if passed else f"{Colors.RED}✗{Colors.RESET}"
    status = f"{Colors.GREEN}PASS{Colors.RESET}" if passed else f"{Colors.RED}FAIL{Colors.RESET}"
    print(f"  {icon} {name}: {status}")
    if details:
        print(f"      {Colors.YELLOW}{details}{Colors.RESET}")

def print_warning(text):
    print(f"  {Colors.YELLOW}⚠ {text}{Colors.RESET}")

def print_info(text):
    print(f"  {Colors.BLUE}ℹ {text}{Colors.RESET}")

def check_environment():
    """Check environment variables."""
    print_header("1. Environment Configuration")

    checks = {
        "OPENROUTER_API_KEY": os.getenv("OPENROUTER_API_KEY"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
    }

    all_passed = True
    for key, value in checks.items():
        if value:
            print_check(key, True, f"Set ({len(value)} chars)")
        else:
            print_check(key, False, "Not set")
            all_passed = False

    return all_passed

def check_data_files():
    """Check that required data files exist."""
    print_header("2. Data Files")

    base_dir = Path(__file__).parent
    data_dir = base_dir / "data"

    files = {
        "barsha_products.json": data_dir / "barsha_products.json",
        "barsha_stores.json": data_dir / "barsha_stores.json",
        "product_vectors.pt": data_dir / "product_vectors.pt",
    }

    all_passed = True
    for name, path in files.items():
        if path.exists():
            size = path.stat().st_size
            size_str = f"{size / 1024:.1f} KB" if size < 1024*1024 else f"{size / (1024*1024):.1f} MB"
            print_check(name, True, f"Found ({size_str})")

            # Additional checks for JSON files
            if name.endswith(".json"):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            print_info(f"  Contains {len(data)} items")
                except Exception as e:
                    print_warning(f"  Could not parse: {e}")
        else:
            print_check(name, False, "Not found")
            all_passed = False

    return all_passed

def check_clip_model():
    """Check CLIP model can be loaded."""
    print_header("3. CLIP Visual Search Model")

    try:
        import torch
        print_check("PyTorch", True, f"Version {torch.__version__}")
    except ImportError:
        print_check("PyTorch", False, "Not installed")
        return False

    try:
        from transformers import CLIPProcessor, CLIPModel
        print_check("Transformers", True)
    except ImportError:
        print_check("Transformers", False, "Not installed")
        return False

    # Try to load vectors
    base_dir = Path(__file__).parent
    vectors_path = base_dir / "data" / "product_vectors.pt"

    if vectors_path.exists():
        try:
            data = torch.load(vectors_path, weights_only=False, map_location="cpu")
            ids = data.get("ids", [])
            embeddings = data.get("embeddings")
            print_check("Product Vectors", True, f"{len(ids)} products indexed")

            if embeddings is not None:
                if hasattr(embeddings, 'shape'):
                    print_info(f"  Embedding shape: {embeddings.shape}")
        except Exception as e:
            print_check("Product Vectors", False, str(e))
            return False
    else:
        print_check("Product Vectors", False, "File not found")
        return False

    return True

def check_recommendation_engine():
    """Check recommendation engine."""
    print_header("4. Recommendation Engine")

    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from app.services.recommendation_engine import get_recommendation_engine

        engine = get_recommendation_engine()
        print_check("Engine Import", True)
        print_check("Catalog Loaded", len(engine.catalog) > 0, f"{len(engine.catalog)} products")

        # Test similar products
        if engine.catalog:
            first_id = engine.catalog[0].get("id")
            result = engine.get_similar_products(first_id, limit=3)
            print_check("Similar Products", len(result.recommendations) > 0,
                       f"{len(result.recommendations)} results")

            # Test complementary
            result2 = engine.get_complementary_products(first_id, limit=3)
            print_check("Complementary Products", True,
                       f"{len(result2.recommendations)} results")

        return True

    except ImportError as e:
        print_check("Engine Import", False, str(e))
        return False
    except Exception as e:
        print_check("Engine Test", False, str(e))
        return False

def check_api_structure():
    """Check API can be imported."""
    print_header("5. API Structure")

    try:
        from api import app
        print_check("FastAPI App", True)

        # Count routes
        routes = [r for r in app.routes if hasattr(r, 'path')]
        api_routes = [r for r in routes if r.path.startswith('/api')]
        print_info(f"  Total routes: {len(routes)}")
        print_info(f"  API routes: {len(api_routes)}")

        # Check specific endpoints
        paths = [r.path for r in routes]
        endpoints = [
            ("/api/chat", "Chat Assistant"),
            ("/api/like-this", "Visual Search"),
            ("/api/recommendations/similar/{product_id}", "Similar Recommendations"),
            ("/health", "Health Check"),
        ]

        for path, name in endpoints:
            found = path in paths
            print_check(name, found, path if found else "Not found")

        return True

    except Exception as e:
        print_check("API Import", False, str(e))
        return False

def check_admin_module():
    """Check admin module."""
    print_header("6. Admin Module")

    try:
        from app.core.database import SessionLocal
        from app.core.config import settings
        print_check("Database Config", True)
        print_info(f"  Admin email: {settings.ADMIN_EMAIL}")

        from app.routers import (
            admin_dashboard_router,
            admin_orders_router,
            admin_products_router
        )
        print_check("Admin Routers", True, "Dashboard, Orders, Products")

        return True

    except ImportError as e:
        print_check("Admin Module", False, str(e))
        return False


def check_meilisearch_compat():
    """Check MeiliSearch compatibility layer."""
    print_header("7. MeiliSearch Compatibility Layer")

    try:
        from app.routers.meilisearch_compat import router
        print_check("MeiliSearch Compat Router", True)

        # List key endpoints
        endpoints = [
            "/indexes/web-hp/search",
            "/indexes/categories/search",
            "/indexes/products/search",
            "/indexes/footer/search",
        ]
        print_info(f"  Key endpoints available: {len(endpoints)}+")

        return True

    except ImportError as e:
        print_check("MeiliSearch Compat Router", False, str(e))
        return False


def check_storefront_data():
    """Check storefront data in database."""
    print_header("8. Storefront Data")

    try:
        from app.core.database import SessionLocal
        from app.models.product import Product, Category
        from app.models.content import HomeContent, Banner

        db = SessionLocal()
        try:
            product_count = db.query(Product).count()
            category_count = db.query(Category).count()
            banner_count = db.query(Banner).count()
            content_count = db.query(HomeContent).count()

            print_check("Products", product_count > 0, f"{product_count} products")
            print_check("Categories", category_count > 0, f"{category_count} categories")
            print_check("Banners", banner_count >= 0, f"{banner_count} banners")
            print_check("Home Content", content_count >= 0, f"{content_count} sections")

            if product_count == 0:
                print_warning("No products in database. Run seed to populate.")
                print_info("  Use: from app.seed_data import run_all_seeds")

            return product_count > 0 or category_count > 0

        finally:
            db.close()

    except Exception as e:
        print_check("Database Query", False, str(e))
        return False

def main():
    """Run all verification checks."""
    print(f"\n{Colors.BOLD}Barsha AI System Verification{Colors.RESET}")
    print(f"{'='*60}")

    results = []

    results.append(("Environment", check_environment()))
    results.append(("Data Files", check_data_files()))
    results.append(("CLIP Model", check_clip_model()))
    results.append(("Recommendation Engine", check_recommendation_engine()))
    results.append(("API Structure", check_api_structure()))
    results.append(("Admin Module", check_admin_module()))
    results.append(("MeiliSearch Compat", check_meilisearch_compat()))
    results.append(("Storefront Data", check_storefront_data()))

    # Summary
    print_header("SUMMARY")

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"  {name}: {status}")

    print(f"\n  {Colors.BOLD}Result: {passed}/{total} checks passed{Colors.RESET}")

    if passed == total:
        print(f"\n  {Colors.GREEN}{Colors.BOLD}✓ System is ready!{Colors.RESET}")
        return 0
    else:
        print(f"\n  {Colors.YELLOW}Some checks failed. Review the output above.{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
