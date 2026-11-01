"""Import the supplied Fuego menu into the versioned app catalog.

Run with the bundled Python runtime containing pdfplumber:
    python -X utf8 tools/import_fuego.py path/to/Cocktaikarte-Fuego-2026-1.pdf
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber


SOURCE_NAME = "Cocktaikarte-Fuego-2026-1.pdf"
HEADINGS = {
    "SOURS", "MOJITOS & JULEPS", "MAI TAI", "ALKOHOLFREI",
    "SPECIAL LONGDRINKS", "LONGDRINKS", "RED BULL", "DAIQUIRIS",
    "MARGARITAS", "CAIPIRINHAS", "ICED TEAS", "VODKA", "BATIDAS",
    "COLADAS", "SPECIALS", "GIN", "TEQUILA", "PRE DINNER",
    "CHAMPAGNER", "AFTER DINNER", "SHOOTERS", "RUM", "BRANDY",
    "WHISKEY",
}
PRICE = re.compile(r"^(.+?)\s+(?:(\d+(?:,\d+)*)\s+)?(\d+\s*,\s*\d+)\s*$")
FOOTER = re.compile(r"^\d{1,2}$")
NON_ENTRIES = (
    "5cl Alkohol", "LONGDRINKS 5cl Alkohol", "mit einer Dose", "Premium-Marken",
    "Alle weiteren Red Bull",
)


def slug(value):
    value = value.lower().replace("ß", "ss")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def ingredient_tags(description, category):
    text = description.lower()
    tags = []
    patterns = {
        "Gin": r"\bgin\b",
        "Rum": r"\brum\b|havana|bacardi",
        "Vodka": r"\bvodka\b",
        "Tequila": r"tequila|tequilla",
        "Whiskey": r"whisk|bourbon|jack daniel|ballantine|four roses",
        "Brandy": r"brandy|cognac|calvados",
        "Champagner": r"champagner",
        "Prosecco": r"prosecco",
        "Ananas": r"ananas|pineapple",
        "Orange": r"orange|o-saft|red orange|blutorange",
        "Zitrone": r"zitrone|lemon",
        "Limette": r"limette|lime juice",
        "Maracuja": r"maracuja|passoa",
        "Erdbeere": r"erdbeer|strawberry",
        "Banane": r"banane|banana",
        "Pfirsich": r"pfirsich|peach",
        "Cranberry": r"cranberry",
        "Grapefruit": r"grapefruit",
        "Kirsche": r"kirsch|cherry",
        "Mango": r"mango",
        "Kokos": r"kokos|malibu|batida",
        "Minze": r"minze|menthe",
        "Schokolade": r"schoko|choco|cacao|kakao|mozartlikör",
        "Milch & Sahne": r"milch|sahne",
        "Apfel": r"apfel|apple",
    }
    for tag, pattern in patterns.items():
        if re.search(pattern, text):
            tags.append(tag)
    if category == "Alkoholfrei":
        tags.insert(0, "Alkoholfrei")
    return tags


def normalize_line(line):
    return re.sub(r"\s+", " ", line).strip()


def parse(pdf_path):
    cocktails = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in range(4, 15):
            lines = [normalize_line(line) for line in (pdf.pages[page_num - 1].extract_text() or "").splitlines()]
            category = None
            current = None
            for line in lines:
                if not line or FOOTER.fullmatch(line):
                    continue
                if line in HEADINGS:
                    category = "Alkoholfrei" if line == "ALKOHOLFREI" else line.title()
                    continue
                if line.startswith(NON_ENTRIES):
                    continue
                match = PRICE.match(line)
                if match and category:
                    if current:
                        cocktails.append(current)
                    name, additives, price = match.groups()
                    current = {
                        "id": "fuego-" + slug(name),
                        "barId": "fuego-wuerzburg",
                        "name": name,
                        "category": category,
                        "description": "",
                        "priceEuro": float(price.replace(" ", "").replace(",", ".")),
                        "ingredientTags": [],
                        "tasteTags": [],
                        "source": {"file": SOURCE_NAME, "page": page_num},
                    }
                elif current:
                    current["description"] = (current["description"] + " " + line).strip()
            if current:
                current["description"] = re.sub(rf"\s+{page_num - 2}$", "", current["description"])
                cocktails.append(current)

    expanded = []
    for drink in cocktails:
        if drink["name"] == "Bacardi Cola / Bacardi Orange":
            for name in ("Bacardi Cola", "Bacardi Orange"):
                expanded.append({**drink, "id": "fuego-" + slug(name), "name": name})
        else:
            expanded.append(drink)
    cocktails = expanded
    for drink in cocktails:
        drink["ingredientTags"] = ingredient_tags(drink["description"] or drink["name"], drink["category"])

    ids = [drink["id"] for drink in cocktails]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate cocktail IDs")
    return {
        "schemaVersion": 1,
        "bars": [{
            "id": "fuego-wuerzburg",
            "name": "Fuego",
            "city": "Würzburg",
            "sources": [{"file": SOURCE_NAME, "version": "2026-1"}],
        }],
        "cocktails": cocktails,
    }


if __name__ == "__main__":
    source = Path(sys.argv[1])
    catalog = parse(source)
    target = Path(__file__).resolve().parents[1] / "web" / "catalog.json"
    target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(catalog['cocktails'])} drinks to {target}")
    from collections import Counter
    print(Counter(item["category"] for item in catalog["cocktails"]))
