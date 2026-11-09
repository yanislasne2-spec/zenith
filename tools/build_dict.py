#!/usr/bin/env python3
"""Construit data/dict.js : un filtre de Bloom des mots français (sans accents).
Sert uniquement à savoir si une réponse « existe » ; une réponse inexistante peut être retentée.
Source : paquet npm an-array-of-french-words (licence MIT, Zeke Sikelianos).
Usage : python3 tools/build_dict.py chemin/vers/index.json"""
import base64, json, math, re, sys, unicodedata, pathlib

EXTRA = """
france allemagne espagne italie portugal belgique suisse autriche angleterre ecosse irlande pays-bas hollande danemark norvege suede finlande islande pologne tchequie slovaquie hongrie roumanie bulgarie grece croatie serbie bosnie slovenie albanie macedoine montenegro kosovo ukraine russie bielorussie moldavie lituanie lettonie estonie luxembourg monaco andorre liechtenstein malte chypre turquie
etats-unis usa amerique canada mexique quebec bresil argentine chili perou colombie venezuela bolivie equateur uruguay paraguay cuba haiti jamaique
chine japon inde coree vietnam thailande indonesie philippines malaisie singapour australie nouvelle-zelande israel palestine liban syrie irak iran arabie egypte maroc algerie tunisie libye senegal
londres berlin madrid rome lisbonne bruxelles amsterdam vienne athenes moscou pekin tokyo washington new york los angeles chicago miami rio sydney montreal dubai istanbul marseille lyon toulouse nice nantes bordeaux lille strasbourg
europe afrique asie oceanie antarctique arctique atlantique pacifique mediterranee
facebook google apple amazon netflix youtube instagram tiktok twitter disney marvel pokemon nintendo playstation xbox
""".split()

def toks(x):
    x = x.lower().replace("œ", "oe").replace("æ", "ae")
    x = unicodedata.normalize("NFD", x)
    x = "".join(c for c in x if not unicodedata.combining(c))
    return [t for t in re.findall(r"[a-z0-9]+", x) if len(t) >= 3]

def fnv(s, h):
    for c in s:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

words = json.load(open(sys.argv[1], encoding="utf-8")) + EXTRA
tokens = sorted({t for w in words for t in toks(w)})
n, p = len(tokens), 0.01
m = int(-n * math.log(p) / (math.log(2) ** 2))
m = (m + 7) // 8 * 8
k = max(1, round(m / n * math.log(2)))
bits = bytearray(m // 8)
for t in tokens:
    h1, h2 = fnv(t, 2166136261), fnv(t, 2166136261 ^ 0x9E3779B9) | 1
    for i in range(k):
        b = ((h1 + i * h2) & 0xFFFFFFFF) % m
        bits[b >> 3] |= 1 << (b & 7)
out = pathlib.Path(__file__).resolve().parent.parent / "data" / "dict.js"
out.write_text(
    "// Filtre de Bloom des mots français (an-array-of-french-words, MIT). Généré par tools/build_dict.py\n"
    f'window.ZDICT={{m:{m},k:{k},b:"{base64.b64encode(bits).decode()}"}};\n', encoding="utf-8")
print("mots", n, "bits", m, "k", k, "taille", out.stat().st_size // 1024, "Ko")
