const text = `- [ID:1645] [42BFRTD03] ROBE | 59.9 TND | Famille:WOMEN | Couleurs+Images: NOIR , COULEUR DEMANDÉE: NOIR → IMG:  | ImgPrincipale: https://barsha.com.tn/img/p/7/3/6/5/7365.jpg | https://barsha.com.tn/fr/produit/1645`;
const r = /(?:^|\n|\s)-?\s*\[ID:(\d+)\]\s*\[([^\]]+)\]\s+([^|]+)\|\s*([^|]+)\|[^|]*\|\s*Couleurs\+Images:\s*([^|]+)\|\s*ImgPrincipale:\s*([^|\n]*)\|?\s*(https?:\/\/[^\s\n]+)/gi;
console.log(r.exec(text));
