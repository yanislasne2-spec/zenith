# Zénith

Quiz de culture générale : plus ta réponse est rare, plus ton avion monte.

- **Vol du jour** : 7 questions tirées au sort selon la date, les mêmes pour tout le monde.
- **Vol infini** : questions sans fin, 3 réservoirs, poussée ×1,15 par bonne réponse, ravitaillement tous les 10 bons tours.
- 20 thèmes, 181 questions, environ 9 000 réponses acceptées. Aucune publicité, aucun compte, tout tourne dans le navigateur.

## Jouer en ligne

https://yanislasne2-spec.github.io/zenith/ (une fois GitHub Pages activé : Settings → Pages → Deploy from a branch → main / root).

## Lancer

Ouvre `index.html` dans un navigateur, ou héberge le dossier tel quel (GitHub Pages, Netlify, OVH…).
`dist/zenith.html` est la version en un seul fichier.

## Ajouter des questions

Chaque fichier de `data/` contient des thèmes au format :

```js
ZDATA.push({ id: "geo", name: "Géographie", color: "#3FA7D6", q: [
  ["Cite un pays d'Afrique", "Maroc;Algérie;Égypte;...;Seychelles"],
]});
```

- Les réponses sont séparées par `;` et classées **de la plus citée à la plus rare** : ce classement détermine l'altitude gagnée.
- Les variantes acceptées d'une même réponse sont séparées par `/` (`Kiev/Kyiv`).
- Accents, majuscules, articles, fautes de frappe et approximations phonétiques sont tolérés automatiquement (« Cntre Vale de Loir » est accepté pour « Centre-Val de Loire »).

## Mots qui n'existent pas

Si une réponse ne correspond à aucun mot connu (dictionnaire français de 319 000 mots + toutes les réponses du jeu), le joueur peut retenter sans pénalité. Valider deux fois le même texte le compte comme une vraie réponse, pour les noms propres absents du dictionnaire.

Le dictionnaire (`data/dict.js`) est un filtre de Bloom généré depuis le paquet npm `an-array-of-french-words` (licence MIT) :

```bash
python3 tools/build_dict.py chemin/vers/an-array-of-french-words/index.json
```

Après modification, régénère la version en un fichier :

```bash
python3 build.py
```
