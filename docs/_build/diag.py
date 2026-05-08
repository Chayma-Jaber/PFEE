# -*- coding: utf-8 -*-
import os, sys
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "ai-service"))
TARGET = os.path.join(ROOT, "main.py")
with open(TARGET, "rb") as f:
    src = f.read().decode("utf-8")

# Locate the precise start
anchor = "# ── Step C: OPENROUTER"
i = src.find(anchor)
print(f"anchor 'Step C' at: {i}")
# Back up to start of line
j = src.rfind("\n", 0, i) + 1
print(f"line starts at: {j}, indent={i-j}")

# Print byte-by-byte the first 50 chars of the line
sample = src[j:j+60]
print(f"sample bytes (UTF-8): {sample.encode('utf-8').hex()}")
print(f"sample chars:")
for ch in sample[:30]:
    print(f"  {ord(ch):04x}  '{ch}'")
