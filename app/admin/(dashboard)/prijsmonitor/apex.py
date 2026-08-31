#!/usr/bin/env python3
"""
🦈 APEX PREDATOR ULTIMATE v9.1 – SYNC EDITION (FIXED)
Robuust, agressief en gegarandeerd werkend op Windows.
Geen asyncio, geen aiohttp. Alleen requests en BeautifulSoup.
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os
import csv
from urllib.parse import urljoin, urlparse
from datetime import datetime
from typing import List, Dict, Set, Optional

# ─── Excel export ────────────────────────────────────────────────────────────
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

# =============================================================================
# CONFIGURATIE
# =============================================================================

SITES = [
    "basboernoten.nl",
    "nootje.eu",
    "noototheek.nl",
    "denotenkoerier.nl",
    "notenkoning.nl",
    "echtepindakaas.nl",
    "notenkraamslagboom.nl",
    "notenhoek.nl",
    "scholtesnotendeli.nl",
    "versenoten.nl",
    "notenkraam.nl",
    "notenstore.nl",
    "nutamo.nl",
    "bionoot.nl",
    "notenleverancier.nl",
    "nutspecials.nl",
    "denotenkoning.nl",
    "notenhuis.nl",
    "notenshop",
]

OUTPUT_DIR = "apex_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 0.5
MAX_DEPTH = 3               # Hoe diep we crawlen voor productlinks
MAX_PAGES_PER_SITE = 200    # Max aantal pagina's om te crawlen

# =============================================================================
# FUNCTIES
# =============================================================================

def fetch_html(url: str) -> Optional[str]:
    """Haal HTML op met retry."""
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 429:
                time.sleep(2 ** attempt)
            else:
                return None
        except Exception:
            time.sleep(1)
    return None

def is_product_url(url: str) -> bool:
    """Uitgebreide product-URL detectie."""
    url_lower = url.lower()
    # Directe productpatronen
    if any(x in url_lower for x in ['/product/', '/p/', '/item/', '/artikel/', '/products/']):
        return True
    # Categorie-specifieke productpagina's (bv. /noten/amandelen)
    patterns = [
        r'/noten/[a-zA-Z0-9\-]+$',
        r'/gedroogd-fruit/[a-zA-Z0-9\-]+$',
        r'/pindas/[a-zA-Z0-9\-]+$',
        r'/chocolade/[a-zA-Z0-9\-]+$',
        r'/snoep/[a-zA-Z0-9\-]+$',
        r'/cadeaus/[a-zA-Z0-9\-]+$',
        r'/muesli/[a-zA-Z0-9\-]+$',
        r'/pitten/[a-zA-Z0-9\-]+$',
        r'/zaden/[a-zA-Z0-9\-]+$',
        r'/amandelen',
        r'/cashewnoten',
        r'/walnoten',
        r'/hazelnoten',
        r'/pecannoten',
        r'/macadamianoten',
        r'/pistachenoten',
        r'/rozijnen',
        r'/abrikozen',
    ]
    for pattern in patterns:
        if re.search(pattern, url_lower):
            return True
    return False

def is_category_url(url: str) -> bool:
    """Bepaal of een URL een categorie- of overzichtspagina is."""
    path = urlparse(url).path
    if not path or path == '/':
        return False
    category_patterns = [
        r'/c/',
        r'/category/',
        r'/categorie/',
        r'/catalog/',
        r'/shop/',
        r'/webshop/',
        r'/assortiment/',
        r'/collectie/',
        r'/noten$',
        r'/gedroogd-fruit$',
        r'/pindas$',
    ]
    for pattern in category_patterns:
        if re.search(pattern, path):
            return True
    if path.count('/') >= 2 and not is_product_url(url):
        return True
    return False

def crawl_for_product_urls(start_url: str) -> Set[str]:
    """Crawl de website en verzamel alle product-URL's."""
    product_urls = set()
    visited = set()
    to_visit = [start_url]
    # Voeg ook bekende categorie-paden toe
    for path in ["/noten", "/producten", "/categorie", "/shop", "/webshop", "/assortiment"]:
        to_visit.append(urljoin(start_url, path))

    while to_visit and len(visited) < MAX_PAGES_PER_SITE:
        url = to_visit.pop()
        if url in visited:
            continue
        visited.add(url)

        html = fetch_html(url)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a['href']
            if href.startswith('#') or href.startswith('javascript:') or href.startswith('mailto:'):
                continue
            full_url = urljoin(start_url, href)
            if not full_url.startswith(start_url):
                continue
            if full_url in visited:
                continue

            if is_product_url(full_url):
                product_urls.add(full_url)
            elif is_category_url(full_url) and len(visited) < MAX_PAGES_PER_SITE:
                to_visit.append(full_url)

        time.sleep(REQUEST_DELAY)

    return product_urls

def extract_price_from_soup(soup: BeautifulSoup) -> Optional[float]:
    # JSON-LD
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and data.get('@type') == 'Product':
                price = data.get('offers', {}).get('price')
                if price:
                    return float(price)
            elif '@graph' in data:
                for item in data['@graph']:
                    if item.get('@type') == 'Product':
                        price = item.get('offers', {}).get('price')
                        if price:
                            return float(price)
        except:
            continue
    # CSS selectors
    selectors = ['.price', '.product-price', '.woocommerce-Price-amount', '.current-price', '.sale-price']
    for sel in selectors:
        elem = soup.select_one(sel)
        if elem:
            text = elem.get_text(strip=True)
            match = re.search(r'[\d.,]+', text)
            if match:
                return float(match.group().replace(',', '.'))
    return None

def extract_name(soup: BeautifulSoup) -> str:
    for sel in ['h1', '.product-title', '.product-name', '.product_title']:
        elem = soup.select_one(sel)
        if elem:
            return elem.get_text(strip=True)
    title = soup.find("title")
    return title.get_text(strip=True) if title else "Onbekend"

def extract_variants(soup: BeautifulSoup, base_price: float) -> List[Dict]:
    variants = []
    # JSON-LD varianten
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and data.get('@type') == 'Product':
                offers = data.get('offers', [])
                if isinstance(offers, dict):
                    offers = [offers]
                for off in offers:
                    var = {
                        "title": off.get('name', 'Standaard'),
                        "price": float(off.get('price', base_price)),
                        "compare_price": float(off.get('price_high', 0)) if off.get('price_high') else None,
                        "sku": off.get('sku'),
                        "unit": extract_unit(off.get('description', '')),
                    }
                    var["unit_price"] = calc_unit_price(var["price"], var["unit"])
                    variants.append(var)
        except:
            continue
    if not variants:
        variants.append({"title": "Standaard", "price": base_price, "compare_price": None, "sku": None, "unit": None, "unit_price": None})
    return variants

def extract_unit(text: str) -> Optional[str]:
    match = re.search(r'(\d+)\s*(gram|g|kg|liter|l|ml)', text, re.IGNORECASE)
    return match.group(0) if match else None

def calc_unit_price(price: float, unit: Optional[str]) -> Optional[float]:
    if not unit:
        return None
    match = re.search(r'(\d+)\s*(gram|g|kg)', unit, re.IGNORECASE)
    if match:
        amount = float(match.group(1))
        unit_type = match.group(2).lower()
        kg = amount / 1000 if unit_type in ['gram', 'g'] else amount
        if kg > 0:
            return round(price / kg, 2)
    return None

def scrape_product_page(url: str) -> Optional[Dict]:
    html = fetch_html(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    name = extract_name(soup)
    price = extract_price_from_soup(soup)
    if price is None:
        return None
    variants = extract_variants(soup, price)

    # Extract description safely
    desc_elem = soup.select_one('.description, .product-description, .woocommerce-product-details__short-description')
    description = desc_elem.get_text(strip=True) if desc_elem else ""

    # Extract SKU safely
    sku_elem = soup.select_one('.sku, .product-sku, [itemprop="sku"]')
    sku = sku_elem.get_text(strip=True) if sku_elem else ""

    return {
        "url": url,
        "name": name,
        "price": price,
        "variants": variants,
        "description": description,
        "sku": sku,
    }

def process_domain(domain: str) -> List[Dict]:
    print(f"\n{'='*60}\n🔄 Verwerken: {domain}\n{'='*60}")
    base_url = f"https://{domain}"
    product_urls = crawl_for_product_urls(base_url)
    print(f"   → {len(product_urls)} product-URL's gevonden")

    products = []
    for i, url in enumerate(product_urls, 1):
        print(f"   [{i}/{len(product_urls)}] {url}")
        product = scrape_product_page(url)
        if product:
            products.append(product)
            print(f"      ✅ {product['name'][:50]} - €{product['price']}")
        else:
            print(f"      ❌ Geen prijs gevonden")
        time.sleep(REQUEST_DELAY)
    return products

# =============================================================================
# OUTPUT
# =============================================================================

def save_json(data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"📄 JSON: {filename}")

def save_csv(data, filename):
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["domein", "product_url", "product_naam", "variant", "prijs", "vergelijkingsprijs", "eenheid", "eenheidsprijs", "sku", "categorieën"])
        for domain, products in data.items():
            for p in products:
                if not p.get('variants'):
                    writer.writerow([domain, p['url'], p['name'], "", "", "", "", "", p.get('sku', ''), ""])
                else:
                    for v in p['variants']:
                        writer.writerow([
                            domain,
                            p['url'],
                            p['name'],
                            v.get('title', ''),
                            v.get('price', ''),
                            v.get('compare_price', ''),
                            v.get('unit', ''),
                            v.get('unit_price', ''),
                            v.get('sku', '') or p.get('sku', ''),
                            ""
                        ])
    print(f"📄 CSV: {filename}")

def save_excel(data, filename):
    if not HAS_OPENPYXL:
        print("⚠️ openpyxl niet geïnstalleerd, Excel overgeslagen.")
        return
    wb = Workbook()
    ws = wb.active
    ws.title = "Producten"
    headers = ["Domein", "Product URL", "Productnaam", "Variant", "Prijs", "Vergelijkingsprijs", "Eenheid", "Eenheidsprijs", "SKU", "Categorieën"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    row = 2
    for domain, products in data.items():
        for p in products:
            if not p.get('variants'):
                ws.cell(row=row, column=1, value=domain)
                ws.cell(row=row, column=2, value=p['url'])
                ws.cell(row=row, column=3, value=p['name'])
                ws.cell(row=row, column=9, value=p.get('sku', ''))
                row += 1
            else:
                for v in p['variants']:
                    ws.cell(row=row, column=1, value=domain)
                    ws.cell(row=row, column=2, value=p['url'])
                    ws.cell(row=row, column=3, value=p['name'])
                    ws.cell(row=row, column=4, value=v.get('title', ''))
                    ws.cell(row=row, column=5, value=v.get('price', ''))
                    ws.cell(row=row, column=6, value=v.get('compare_price', ''))
                    ws.cell(row=row, column=7, value=v.get('unit', ''))
                    ws.cell(row=row, column=8, value=v.get('unit_price', ''))
                    ws.cell(row=row, column=9, value=v.get('sku', '') or p.get('sku', ''))
                    row += 1
    for col in ws.columns:
        max_len = 0
        for cell in col:
            try:
                max_len = max(max_len, len(str(cell.value)))
            except:
                pass
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)
    wb.save(filename)
    print(f"📄 Excel: {filename}")

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║  🦈 APEX PREDATOR ULTIMATE v9.1 – SYNC EDITION                  ║
    ║  Geen asyncio, geen aiohttp. Alleen requests + BeautifulSoup.   ║
    ║  Werkt gegarandeerd op Windows.                                ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)

    all_results = {}
    for domain in SITES:
        products = process_domain(domain)
        all_results[domain] = products

    # Output
    base = os.path.join(OUTPUT_DIR, f"apex_scan_{TIMESTAMP}")
    save_json(all_results, f"{base}.json")
    save_csv(all_results, f"{base}.csv")
    save_excel(all_results, f"{base}.xlsx")

    total = sum(len(p) for p in all_results.values())
    print(f"\n✅ Klaar! Totaal {total} producten opgehaald. Bestanden in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()