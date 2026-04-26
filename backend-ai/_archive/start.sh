#!/bin/bash

echo "========================================"
echo "  Barsha Unified Backend - Starting"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "No virtual environment found. Using system Python."
fi

echo ""
echo "Starting Unified API on http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""

python unified_api.py
