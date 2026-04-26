"""
Pytest configuration for Barsha AI tests.
"""

import pytest
import os
import sys

# Add backend-ai to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)


@pytest.fixture(scope="session")
def catalog_path():
    """Return path to product catalog."""
    return os.path.join(backend_dir, "data", "barsha_products.json")


@pytest.fixture(scope="session")
def vectors_path():
    """Return path to CLIP vectors."""
    return os.path.join(backend_dir, "data", "product_vectors.pt")


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: marks integration tests")
    config.addinivalue_line("markers", "ai: marks AI-specific tests")
