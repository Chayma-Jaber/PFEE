# -*- coding: utf-8 -*-
"""Patch ai-service/main.py.

The chatbot's last-resort branch raises an exception when no LLM provider is
available, which makes the UI display "Désolé, j'ai rencontré un problème
technique" — looking like a real error to end users. This patch replaces that
branch with a deterministic, templated answer.

Idempotent.
"""
import os, sys, py_compile

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "ai-service"))
TARGET = os.path.join(ROOT, "main.py")

with open(TARGET, "rb") as f:
    raw = f.read()
crlf = b"\r\n" in raw[:4096]
text = raw.decode("utf-8")
# Normalise to LF for matching, we'll restore the original line ending at the end.
work = text.replace("\r\n", "\n")

OLD_BLOCK = '''        # ── Step C: OPENROUTER (CLOUD FALLBACK #2) ──
        logger.info("CHAT: trying OpenRouter (cloud fallback #2)...")
        if not OPENROUTER_API_KEY and not GEMINI_API_KEY:
            raise Exception("No API keys configured (Ollama unavailable, no Gemini or OpenRouter key).")

        or_resp = await call_openrouter_chat(final_messages, model_override=request.model)
        if or_resp:
            or_resp["catalog_hits"] = raw_hits
            return or_resp

        raise Exception("No AI model responded.")

    except Exception as err:
        tb = traceback.format_exc()
        logger.error(f"CHAT ERROR:\\n{tb}")
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": f"D\\u00e9sol\\u00e9, j\'ai rencontr\\u00e9 un probl\\u00e8me technique.\\n\\nErreur : {str(err)}",
                }
            }],
            "debug": tb,
        }'''

NEW_BLOCK = '''        # ── Step C: OPENROUTER (CLOUD FALLBACK #2) ──
        if OPENROUTER_API_KEY:
            logger.info("CHAT: trying OpenRouter (cloud fallback #2)...")
            or_resp = await call_openrouter_chat(final_messages, model_override=request.model)
            if or_resp:
                or_resp["catalog_hits"] = raw_hits
                return or_resp

        # ── Step D: LOCAL DETERMINISTIC FALLBACK ──
        # All LLM providers are unavailable. Return a useful templated answer
        # so the chatbot UI never shows a raw error to the end user.
        logger.warning("CHAT: no LLM available, returning deterministic fallback")
        fallback_text = build_local_chat_answer(user_query, raw_hits)
        return {
            "choices": [{"message": {"role": "assistant", "content": fallback_text}}],
            "catalog_hits": raw_hits,
            "model": "local_fallback",
        }

    except Exception as err:
        tb = traceback.format_exc()
        logger.error(f"CHAT ERROR: {tb}")
        try:
            user_q = request.messages[-1].content if request.messages else ""
            fallback_text = build_local_chat_answer(user_q, [])
        except Exception:
            fallback_text = (
                "Bonjour ! Je suis l\'assistant Barsha. "
                "Que puis-je faire pour vous ?"
            )
        return {
            "choices": [{"message": {"role": "assistant", "content": fallback_text}}],
            "catalog_hits": [],
            "model": "local_fallback_error",
            "debug": tb[:500],
        }


def build_local_chat_answer(user_query: str, hits: list) -> str:
    """Compose a useful French reply without any LLM (templated answers)."""
    q = (user_query or "").lower().strip()

    greetings = {"bonjour", "hello", "hi", "salut", "hey", "coucou", "bonsoir", "yo"}
    if not q or (any(g in q for g in greetings) and len(q) <= 30):
        return (
            "Bonjour ! Je suis l\'assistant Barsha.\\n\\n"
            "Je peux vous aider à :\\n"
            "• Trouver une tenue (robe, chemise, pantalon, chaussures...)\\n"
            "• Composer un look pour une occasion (mariage, soirée, bureau, plage...)\\n"
            "• Suivre une commande ou initier un retour\\n\\n"
            "Que recherchez-vous aujourd\'hui ?"
        )

    if any(k in q for k in ["livraison", "expedition", "expedit", "delai", "delais"]):
        return (
            "Livraison Barsha :\\n\\n"
            "Nous livrons partout en Tunisie en 2 à 5 jours ouvrables. "
            "La livraison est gratuite à partir de 200 TND. Vous pouvez "
            "également récupérer votre commande dans nos points relais."
        )
    if any(k in q for k in ["retour", "echange", "rembourser", "remboursement"]):
        return (
            "Retours et échanges :\\n\\n"
            "Vous disposez de 14 jours après réception pour retourner ou "
            "échanger un article. Connectez-vous puis allez dans Mon compte > "
            "Mes commandes pour initier la demande en quelques clics."
        )
    if any(k in q for k in ["paiement", "carte", "click to pay", "ctp"]):
        return (
            "Modes de paiement :\\n\\n"
            "Nous acceptons la carte bancaire (Click-to-Pay) et le paiement à "
            "la livraison (COD). Le paiement carte est 100% sécurisé."
        )
    if any(k in q for k in ["taille", "guide"]):
        return (
            "Guide des tailles :\\n\\n"
            "Chaque fiche produit affiche le guide des tailles correspondant. "
            "Si vous hésitez, prenez la taille au-dessus pour les coupes ajustées."
        )
    if any(k in q for k in ["soldes", "promo", "promotion", "reduction"]):
        return (
            "Promotions en cours :\\n\\n"
            "Retrouvez nos offres flash sur la page d\'accueil. Le code WELCOME10 "
            "vous offre 10% sur votre première commande."
        )

    if hits:
        top = hits[: min(5, len(hits))]
        lines = ["Voici quelques pièces qui correspondent à votre recherche :\\n"]
        for p in top:
            name = p.get("nom") or p.get("title") or "Article"
            price = p.get("currentPrice") or p.get("prix") or p.get("price") or 0
            pid = p.get("id") or "?"
            try:
                price = float(price)
                lines.append(f"• [ID:{pid}] {name} — {price:.2f} TND")
            except (TypeError, ValueError):
                lines.append(f"• [ID:{pid}] {name}")
        lines.append("\\nSouhaitez-vous voir d\'autres options ou affiner par couleur / taille ?")
        return "\\n".join(lines)

    return (
        "Je suis là pour vous aider à trouver la tenue parfaite. "
        "Pouvez-vous préciser ce que vous recherchez ?\\n\\n"
        "Par exemple : une robe pour mariage, chemise homme blanche, "
        "chaussures de sport, ou demandez conseil pour une occasion."
    )'''

if "build_local_chat_answer" in work:
    print("PATCH ALREADY APPLIED")
    sys.exit(0)

if OLD_BLOCK not in work:
    # Try to find what's similar
    pos = work.find("# ── Step C: OPENROUTER")
    if pos < 0:
        print("anchor not found at all")
        sys.exit(1)
    print("OLD BLOCK NOT FOUND.")
    print(f"file portion at anchor (first 1500 chars):")
    print(repr(work[pos-8:pos+1200].encode("utf-8")))
    sys.exit(1)

new_work = work.replace(OLD_BLOCK, NEW_BLOCK, 1)
out = new_work.replace("\n", "\r\n") if crlf else new_work
with open(TARGET, "wb") as f:
    f.write(out.encode("utf-8"))

print(f"patched: {len(text)} -> {len(out)} chars (line ending: {'CRLF' if crlf else 'LF'})")
py_compile.compile(TARGET, doraise=True)
print("SYNTAX OK")
