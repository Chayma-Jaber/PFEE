import re

text = "- [ID:1616] [42BFRD03] ROBE | 69.9 TND | Famille:WOMEN | Couleurs+Images: NOIR , COULEUR DEMANDÉE: NOIR → IMG:  | ImgPrincipale: https://barsha.com.tn/img/p/7/3/1/2/7312.jpg | https://barsha.com.tn/fr/produit/1616"

pattern = r"(?:^|\n|\s)-?\s*\[ID:(\d+)\]\s*\[([^\]]+)\]\s+([^|]+)\|\s*([^|]+)\|[^|]*\|\s*Couleurs\+Images:\s*([^|]+)\|\s*ImgPrincipale:\s*([^|\n]*)\|?\s*(https?:\/\/[^\s\n]+)"

res = list(re.finditer(pattern, text, re.IGNORECASE))
print(f"Matches count: {len(res)}")
if res:
    m = res[0]
    print(f"PID: {m.group(1)}")
    print(f"REF: {m.group(2)}")
    print(f"NOM: {m.group(3)}")
    print(f"PRIX: {m.group(4)}")
    print(f"COLORS: {m.group(5)}")
    print(f"IMG: {m.group(6)}")
    print(f"URL: {m.group(7)}")
