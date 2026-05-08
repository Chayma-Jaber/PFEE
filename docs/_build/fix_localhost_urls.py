# -*- coding: utf-8 -*-
"""Replace hardcoded http://localhost:80xx URLs with environementDev.api references.
Adds the import where missing. Idempotent — safe to re-run.
"""
import os, re

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "src", "app"))
ENV_FROM_ROOT = "src/environements/environementDev"


def rel_import_path(file_path: str) -> str:
    """Compute the import path from the given file to environementDev."""
    rel = os.path.relpath(
        os.path.join(os.path.dirname(__file__), "..", "..", ENV_FROM_ROOT),
        os.path.dirname(file_path),
    ).replace(os.sep, "/")
    if not rel.startswith("."):
        rel = "./" + rel
    return rel


def patch(file_path: str):
    with open(file_path, encoding="utf-8") as f:
        src = f.read()

    orig = src
    # Replace any 'http://localhost:80\d\d' literal that's followed by '/api'.
    # Two cases:
    #  - 'http://localhost:8000/api'   →  ${environementDev.api} + '/api'
    #  - 'http://localhost:8001/api/x' →  ${environementDev.api} + '/api/x'
    # Use template-literal style so callers can keep doing concat or .post(url).
    def repl_quoted(m):
        # Whole "http://localhost:8000/api/whatever..." string → backticked template.
        url = m.group(0)
        path_after_port = url.split(":80", 1)[1]
        # path_after_port = "00/api/...'" or "00/api/x'"
        # take everything after the port digits
        i = 0
        while i < len(path_after_port) and path_after_port[i].isdigit():
            i += 1
        path = path_after_port[i:].rstrip("'\"")
        return "`${environementDev.api}" + path + "`"

    src = re.sub(r"['\"]http://localhost:80\d{2}(/[^'\"]+)?['\"]", repl_quoted, src)

    if src == orig:
        return False, "no change"

    # Add import if missing.
    if "environementDev" in src and "import { environementDev }" not in src:
        rel = rel_import_path(file_path)
        # Find the last existing import to insert after it.
        lines = src.split("\n")
        last_import = -1
        for i, line in enumerate(lines):
            if line.strip().startswith("import "):
                last_import = i
        new_import = f"import {{ environementDev }} from '{rel}';"
        if last_import >= 0:
            lines.insert(last_import + 1, new_import)
        else:
            lines.insert(0, new_import)
        src = "\n".join(lines)

    with open(file_path, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    return True, "patched"


targets = [
    "features/admin/services/admin.service.ts",
    "features/admin/components/admin-layout/admin-layout.component.ts",
    "features/admin/components/orders/orders.component.ts",
    "features/admin/components/customers/customers.component.ts",
    "features/admin/components/outfits/outfits.component.ts",
    "features/admin/components/loyalty/loyalty.component.ts",
    "features/admin/components/alerts/alerts.component.ts",
    "features/admin/components/login/admin-login.component.ts",
    "services/chatbot.service.ts",
]

for t in targets:
    p = os.path.join(ROOT, t)
    if not os.path.exists(p):
        print(f"  MISS  {t}")
        continue
    changed, msg = patch(p)
    print(f"  {'EDIT' if changed else 'SKIP'}  {t}  ({msg})")
