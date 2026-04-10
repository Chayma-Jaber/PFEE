import os
import requests
import json
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-2.0-flash-lite-001" # Modèle ID correct sur OpenRouter
CONTEXT_FILE = "barsha_context.txt"

def get_chat_response(messages):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "Barsha CLI Chatbot"
    }
    
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        data = response.json()
        
        if response.status_code != 200:
            return f"Erreur API ({response.status_code}) : {json.dumps(data)}"
        
        choices = data.get('choices', [])
        if not choices:
            return f"Erreur : Pas de choix dans la réponse. JSON complet : {json.dumps(data)}"
            
        message = choices[0].get('message', {})
        content = message.get('content')
        
        if content is None:
            # Souvent un problème de modération ou de limitation du modèle
            return f"Réponse vide (null). Modèle utilisé : {data.get('model', 'inconnu')}. Vérifiez vos quotas ou essayez une question plus courte."
            
        return content
    except Exception as e:
        return f"Erreur de connexion : {str(e)}"

def main():
    print("=== BARSHA CHATBOT CLI ===")
    
    if not OPENROUTER_API_KEY:
        print("Erreur : OPENROUTER_API_KEY non trouvée dans le fichier .env")
        return
        
    # Charger le contexte Barsha
    if os.path.exists(CONTEXT_FILE):
        with open(CONTEXT_FILE, "r", encoding="utf-8") as f:
            context = f.read()
    else:
        print(f"Attention : {CONTEXT_FILE} non trouvé. L'IA n'aura pas de contexte.")
        context = "Tu es un assistant shopping pour Barsha."

    # Initialiser l'historique avec le système prompt (contexte)
    messages = [
        {"role": "system", "content": f"Tu es Barsha Assistant. Voici ton contexte :\n{context}"}
    ]
    
    print("\nChatbot prêt ! Tapez 'exit' pour quitter.\n")
    
    while True:
        user_input = input("Vous : ")
        if user_input.lower() in ["exit", "quit", "quitter"]:
            break
            
        messages.append({"role": "user", "content": user_input})
        
        print("Assistant en train de réfléchir...", end="\r")
        reply = get_chat_response(messages)
        print("Assistant : " + str(reply) + "\n")
        
        messages.append({"role": "assistant", "content": reply})

if __name__ == "__main__":
    main()
