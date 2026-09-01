"""
🦈 Noototheek.nl Scraper
Gebruikt de Shopify JSON-API voor maximale snelheid en betrouwbaarheid.
Scrapt alle producten, prijzen, categorieën en meer.
"""

import requests
import json
import time
import re
from urllib.parse import urljoin

# =============================================================================
# CONFIGURATIE
# =============================================================================
BASE_URL = "https://noototheek.nl"
OUTPUT_FILE = "noototheek_producten.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 0.5  # Seconden tussen requests

# =============================================================================
# FUNCTIES
# =============================================================================

def fetch_json(url):
    """Haal JSON-data op van een URL."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Fout bij ophalen {url}: {e}")
        return None

def extract_unit_price(variant):
    """
    Probeer de eenheidsprijs te extraheren uit de varianttitel.
    Bijv. "250 gram zak" -> prijs per kg.
    """
    title = variant.get('option1', '')
    price = float(variant.get('price', 0))
    
    # Zoek naar gewicht in de titel
    weight_match = re.search(r'(\d+)\s*(gram|kg|g)', title, re.IGNORECASE)
    if weight_match:
        amount = float(weight_match.group(1))
        unit = weight_match.group(2).lower()
        
        # Reken om naar kg
        if unit in ['gram', 'g']:
            kg = amount / 1000
        elif unit == 'kg':
            kg = amount
        else:
            return None
        
        if kg > 0:
            unit_price = price / kg
            return round(unit_price, 2)
    
    return None

def parse_product(product_data):
    """
    Extraheer alle relevante productinformatie uit de JSON-data.
    """
    # Basisgegevens
    product = {
        "id": product_data.get('id'),
        "handle": product_data.get('handle'),
        "title": product_data.get('title'),
        "url": urljoin(BASE_URL, f"/products/{product_data.get('handle')}"),
        "vendor": product_data.get('vendor'),
        "product_type": product_data.get('product_type'),
        "tags": product_data.get('tags', []),
        "created_at": product_data.get('created_at'),
        "updated_at": product_data.get('updated_at'),
        "variants": []
    }
    
    # Varianten (verschillende verpakkingsgroottes)
    for variant in product_data.get('variants', []):
        variant_data = {
            "id": variant.get('id'),
            "title": variant.get('title'),
            "sku": variant.get('sku'),
            "price": float(variant.get('price', 0)),
            "compare_at_price": float(variant.get('compare_at_price', 0)) if variant.get('compare_at_price') else None,
            "available": variant.get('available', False),
            "option1": variant.get('option1'),
            "option2": variant.get('option2'),
            "option3": variant.get('option3'),
            "unit_price": extract_unit_price(variant)  # Berekende eenheidsprijs
        }
        product['variants'].append(variant_data)
    
    return product

def get_all_products():
    """
    Haal alle producten op via de collectie-API.
    """
    all_products = []
    page = 1
    limit = 250  # Maximaal aantal producten per pagina
    
    while True:
        print(f"📄 Pagina {page} ophalen...")
        url = f"{BASE_URL}/collections/all/products.json?page={page}&limit={limit}"
        data = fetch_json(url)
        
        if not data or not data.get('products'):
            break
        
        products = data['products']
        print(f"   → {len(products)} producten gevonden op deze pagina")
        
        for product_data in products:
            parsed = parse_product(product_data)
            all_products.append(parsed)
        
        # Controleer of er nog een volgende pagina is
        if len(products) < limit:
            break
        
        page += 1
        time.sleep(REQUEST_DELAY)
    
    return all_products

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("🦈 Noototheek.nl Scraper")
    print("=" * 60)
    
    # 1. Alle producten ophalen
    print("\n🔍 Producten verzamelen via API...")
    products = get_all_products()
    
    if not products:
        print("❌ Geen producten gevonden! Controleer de URL.")
        return
    
    print(f"\n✅ {len(products)} producten gevonden.")
    
    # 2. Opslaan als JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    
    # 3. Samenvatting
    print("\n" + "=" * 60)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")
    
    # Toon een paar voorbeelden
    if products:
        print("\n📦 Voorbeelden:")
        for p in products[:5]:
            print(f"   - {p['title']}")
            for v in p['variants'][:2]:
                price_display = f"€{v['price']:.2f}"
                if v['compare_at_price']:
                    price_display += f" (was €{v['compare_at_price']:.2f})"
                if v['unit_price']:
                    price_display += f" | Eenheidsprijs: €{v['unit_price']:.2f}/kg"
                print(f"      - {v['title']}: {price_display}")

if __name__ == "__main__":
    main()