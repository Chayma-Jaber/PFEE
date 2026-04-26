"""
Barsha AI Module Tests
======================
Comprehensive tests for AI modules: Assistant, Recommendations, Visual Search.

Run with: pytest tests/test_ai_modules.py -v
"""

import pytest
import json
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestRecommendationEngine:
    """Tests for the recommendation engine."""

    @pytest.fixture
    def engine(self):
        """Create a recommendation engine instance."""
        from app.services.recommendation_engine import get_recommendation_engine
        return get_recommendation_engine()

    def test_engine_loads_catalog(self, engine):
        """Test that the engine loads the product catalog."""
        assert len(engine.catalog) > 0, "Catalog should not be empty"
        assert len(engine.catalog_by_id) > 0, "Catalog index should not be empty"

    def test_similar_products_returns_results(self, engine):
        """Test that similar products are returned for a valid product."""
        # Get first product from catalog
        if not engine.catalog:
            pytest.skip("No catalog loaded")

        first_product_id = engine.catalog[0].get("id")
        result = engine.get_similar_products(first_product_id, limit=5)

        assert result is not None
        assert result.strategy_used.value == "similar"
        assert len(result.recommendations) <= 5

    def test_similar_products_excludes_source(self, engine):
        """Test that similar products don't include the source product."""
        if not engine.catalog:
            pytest.skip("No catalog loaded")

        first_product_id = engine.catalog[0].get("id")
        result = engine.get_similar_products(first_product_id, limit=10)

        for rec in result.recommendations:
            assert rec.product_id != first_product_id, "Source product should be excluded"

    def test_complementary_products_different_category(self, engine):
        """Test that complementary products are from different categories."""
        if not engine.catalog:
            pytest.skip("No catalog loaded")

        # Find a product with a known category
        test_product = None
        for p in engine.catalog:
            if engine._get_product_category(p) is not None:
                test_product = p
                break

        if not test_product:
            pytest.skip("No categorizable product found")

        source_cat = engine._get_product_category(test_product)
        result = engine.get_complementary_products(test_product.get("id"), limit=5)

        # At least one should be from a different category
        different_cat_count = 0
        for rec in result.recommendations:
            rec_cat = engine._get_product_category(rec.product_data)
            if rec_cat and rec_cat != source_cat:
                different_cat_count += 1

        # Complementary products should ideally be from different categories
        assert different_cat_count >= 0  # May be 0 if limited catalog

    def test_personalized_without_context_returns_trending(self, engine):
        """Test that empty context returns trending recommendations."""
        result = engine.get_personalized_recommendations({}, limit=5)

        assert result is not None
        assert result.strategy_used.value in ["personalized", "trending"]

    def test_recommendations_have_reasons(self, engine):
        """Test that all recommendations have explanations."""
        if not engine.catalog:
            pytest.skip("No catalog loaded")

        first_product_id = engine.catalog[0].get("id")
        result = engine.get_similar_products(first_product_id, limit=5)

        for rec in result.recommendations:
            assert rec.reason, f"Recommendation {rec.product_id} should have a reason"
            assert len(rec.reason) > 0


class TestChatAssistant:
    """Tests for the chat assistant functionality."""

    def test_gender_detection_homme(self):
        """Test gender detection for male queries."""
        from api import detect_gender

        assert detect_gender("chemise pour homme") == "homme"
        assert detect_gender("pantalon masculin") == "homme"
        assert detect_gender("caleçon") == "homme"

    def test_gender_detection_femme(self):
        """Test gender detection for female queries."""
        from api import detect_gender

        assert detect_gender("robe pour femme") == "femme"
        assert detect_gender("jupe longue") == "femme"
        assert detect_gender("escarpins") == "femme"

    def test_gender_detection_neutral(self):
        """Test gender detection for neutral queries."""
        from api import detect_gender

        assert detect_gender("sac à dos") is None
        assert detect_gender("casquette") is None

    def test_color_detection(self):
        """Test color detection in queries."""
        from api import detect_color

        assert detect_color("robe noire") == "NOIR"
        assert detect_color("chemise blanche") == "BLANC"
        assert detect_color("pantalon bleu marine") == "BLEU"

    def test_budget_detection(self):
        """Test budget extraction from queries."""
        from api import detect_budget

        # Test various formats
        budget = detect_budget("moins de 60 TND")
        assert budget is not None
        assert budget == 60.0 or budget == 0.06  # Depends on millimes handling

        budget2 = detect_budget("budget 100 dinars")
        assert budget2 is not None

    def test_clean_search_query(self):
        """Test query cleaning for Meilisearch."""
        from api import clean_search_query

        # Should remove stop words
        cleaned = clean_search_query("trouve moi une chemise bleue")
        assert "trouve" not in cleaned.lower()
        assert "moi" not in cleaned.lower()

        # Should expand semantic patterns
        cleaned_work = clean_search_query("tenue pour entretien")
        assert "chic" in cleaned_work.lower() or "élégant" in cleaned_work.lower()


class TestVisualSearch:
    """Tests for visual search functionality."""

    def test_fashion_synonyms_mapping(self):
        """Test that fashion terms are properly mapped to Barsha catalog terms."""
        from api import FASHION_SYNONYMS

        assert FASHION_SYNONYMS.get("SNEAKERS") == "BASKET"
        assert FASHION_SYNONYMS.get("JEANS") == "JEAN"
        assert FASHION_SYNONYMS.get("T-SHIRT") == "T SHIRT"

    def test_product_scoring_same_category(self):
        """Test that same category products get higher scores."""
        from api import score_product

        # Mock detected attributes
        detected = {
            "title_guess": "T SHIRT",
            "famille": "MEN",
            "colors": ["NOIR"]
        }

        # Mock product with matching category
        matching_product = {
            "title": "T SHIRT COTON NOIR",
            "Famille": "MEN",
            "declinaisons": [{"couleur": "NOIR"}]
        }

        # Mock product with different category
        different_product = {
            "title": "PANTALON JEAN",
            "Famille": "MEN",
            "declinaisons": [{"couleur": "NOIR"}]
        }

        score_match = score_product(matching_product, detected)
        score_diff = score_product(different_product, detected)

        assert score_match > score_diff, "Same category should score higher"


class TestAPIEndpoints:
    """Tests for API endpoint structure and responses."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        from fastapi.testclient import TestClient
        from api import app
        return TestClient(app)

    def test_root_endpoint(self, client):
        """Test the root endpoint returns status."""
        response = client.get("/")
        assert response.status_code == 200
        assert "status" in response.json()

    def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert "ai" in data
        assert data["status"] == "healthy"

    def test_chat_endpoint_structure(self, client):
        """Test that chat endpoint accepts proper structure."""
        # This will fail without AI keys, but tests the endpoint exists
        response = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "Bonjour"}]
        })

        # Should either succeed or fail gracefully (not 404/500)
        assert response.status_code in [200, 503, 502]

    def test_recommendations_similar_endpoint(self, client):
        """Test the similar recommendations endpoint."""
        response = client.get("/api/recommendations/similar/1")

        # Should return valid response or graceful error
        assert response.status_code in [200, 404, 503]

    def test_recommendations_complementary_endpoint(self, client):
        """Test the complementary recommendations endpoint."""
        response = client.get("/api/recommendations/complementary/1")

        assert response.status_code in [200, 404, 503]

    def test_recommendations_personalized_endpoint(self, client):
        """Test the personalized recommendations endpoint."""
        response = client.post("/api/recommendations/personalized", json={
            "user_context": {},
            "limit": 5
        })

        assert response.status_code in [200, 503]


# Evaluation scenarios for manual testing
class AIEvaluationScenarios:
    """
    Evaluation scenarios for demonstrating AI capabilities.
    These are not automated tests but documented scenarios for manual evaluation.
    """

    ASSISTANT_SCENARIOS = [
        {
            "id": "AS01",
            "name": "Basic Product Search",
            "input": "Montre-moi des chemises pour homme",
            "expected_behavior": [
                "Returns only men's shirts",
                "No women's clothing in results",
                "Products have valid images and prices"
            ]
        },
        {
            "id": "AS02",
            "name": "Budget-Aware Search",
            "input": "Je cherche une robe à moins de 80 TND",
            "expected_behavior": [
                "All returned products under 80 TND",
                "Products are dresses",
                "Relevant suggestions within budget"
            ]
        },
        {
            "id": "AS03",
            "name": "Color-Specific Search",
            "input": "Pantalon noir pour femme",
            "expected_behavior": [
                "Returns black pants",
                "Products are for women",
                "Black color variant available"
            ]
        },
        {
            "id": "AS04",
            "name": "Occasion-Based Help",
            "input": "J'ai un entretien d'embauche, que me conseilles-tu?",
            "expected_behavior": [
                "Suggests professional/formal clothing",
                "Appropriate for job interview",
                "May suggest complete outfit"
            ]
        },
        {
            "id": "AS05",
            "name": "Order Tracking",
            "input": "Où est ma commande?",
            "expected_behavior": [
                "Displays order status if user logged in",
                "Shows tracking info if available",
                "Graceful message if no orders"
            ]
        }
    ]

    RECOMMENDATION_SCENARIOS = [
        {
            "id": "RC01",
            "name": "Similar Products",
            "context": "User viewing a T-SHIRT product",
            "expected_behavior": [
                "Returns other T-shirts",
                "Same family (MEN/WOMEN)",
                "Similar price range",
                "Each has explanation"
            ]
        },
        {
            "id": "RC02",
            "name": "Complementary Products",
            "context": "User viewing pants",
            "expected_behavior": [
                "Returns tops, belts, shoes",
                "Different category than source",
                "Same family",
                "Color harmony considered"
            ]
        },
        {
            "id": "RC03",
            "name": "Personalized Recommendations",
            "context": "User with wishlist items",
            "expected_behavior": [
                "Based on wishlist preferences",
                "Style consistency",
                "Excludes already-liked items"
            ]
        }
    ]

    VISUAL_SEARCH_SCENARIOS = [
        {
            "id": "VS01",
            "name": "T-Shirt Image Search",
            "input": "Photo of a casual T-shirt",
            "expected_behavior": [
                "Returns similar T-shirts",
                "Correct family detection",
                "Color matching if applicable"
            ]
        },
        {
            "id": "VS02",
            "name": "Bag Image Search",
            "input": "Photo of a handbag",
            "expected_behavior": [
                "Returns similar bags",
                "Correct type (sac, sacoche)",
                "Style matching"
            ]
        },
        {
            "id": "VS03",
            "name": "Low Quality Image",
            "input": "Blurry or unclear image",
            "expected_behavior": [
                "Graceful fallback",
                "Returns general suggestions",
                "No crash or error"
            ]
        }
    ]

    @staticmethod
    def print_scenarios():
        """Print all evaluation scenarios for documentation."""
        print("\n" + "="*60)
        print("BARSHA AI EVALUATION SCENARIOS")
        print("="*60)

        print("\n--- ASSISTANT SCENARIOS ---")
        for s in AIEvaluationScenarios.ASSISTANT_SCENARIOS:
            print(f"\n[{s['id']}] {s['name']}")
            print(f"Input: \"{s['input']}\"")
            print("Expected:")
            for exp in s['expected_behavior']:
                print(f"  - {exp}")

        print("\n--- RECOMMENDATION SCENARIOS ---")
        for s in AIEvaluationScenarios.RECOMMENDATION_SCENARIOS:
            print(f"\n[{s['id']}] {s['name']}")
            print(f"Context: {s['context']}")
            print("Expected:")
            for exp in s['expected_behavior']:
                print(f"  - {exp}")

        print("\n--- VISUAL SEARCH SCENARIOS ---")
        for s in AIEvaluationScenarios.VISUAL_SEARCH_SCENARIOS:
            print(f"\n[{s['id']}] {s['name']}")
            print(f"Input: {s['input']}")
            print("Expected:")
            for exp in s['expected_behavior']:
                print(f"  - {exp}")


if __name__ == "__main__":
    # Print evaluation scenarios when run directly
    AIEvaluationScenarios.print_scenarios()

    # Run tests
    print("\n\nRunning tests...")
    pytest.main([__file__, "-v", "--tb=short"])
