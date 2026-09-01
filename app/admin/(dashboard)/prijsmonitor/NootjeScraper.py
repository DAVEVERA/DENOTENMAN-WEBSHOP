"""
🦈 Nootje.eu Scraper
Scrapt alle producten, prijzen en categorieën van nootje.eu.
Gebruikt de WooCommerce-structuur voor maximale dekking.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin, urlparse

# =============================================================================
# CONFIGURATIE
# =============================================================================
BASE_URL = "https://nootje.eu"
OUTPUT_FILE = "nootje_producten.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 0.5  # Seconden tussen requests (vriendelijk voor de server)

# =============================================================================
# FUNCTIES
# =============================================================================

def fetch_html(url):
    """Haal de HTML van een URL op."""
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"❌ Fout bij ophalen {url}: {e}")
        return None

def extract_product_links_from_page(html, base_url):
    """
    Extraheer alle productlinks van een overzichtspagina (webshop of categorie).
    Zoekt naar links met het patroon /product/....
    """
    soup = BeautifulSoup(html, "html.parser")
    product_links = set()
    
    # Zoek naar alle links met /product/ in de href
    for a in soup.find_all("a", href=True):
        href = a['href']
        if '/product/' in href:
            full_url = urljoin(base_url, href)
            # Normaliseer de URL (verwijder eventuele parameters)
            parsed = urlparse(full_url)
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            product_links.add(clean_url)
    
    return product_links

def extract_pagination_links(html, base_url):
    """
    Extraheer de "volgende pagina" link van een overzichtspagina.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Zoek naar een link met 'next' of 'volgende'
    next_link = None
    for a in soup.find_all("a", href=True):
        if 'next' in a.get('class', []) or 'volgende' in a.get_text().lower():
            next_link = urljoin(base_url, a['href'])
            break
    
    # Fallback: zoek naar een link met /page/ in de URL en 'volgende' of 'next'
    if not next_link:
        for a in soup.find_all("a", href=True):
            href = a['href']
            if '/page/' in href and ('volgende' in a.get_text().lower() or 'next' in a.get_text().lower()):
                next_link = urljoin(base_url, href)
                break
    
    return next_link

def parse_product_page(html, url):
    """
    Extraheer alle productinformatie van een productpagina.
    Gebruikt zowel JSON-LD als HTML-fallback.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # --- 1. Productnaam ---
    # Eerst proberen via JSON-LD
    name = None
    price = None
    description = None
    sku = None
    categories = []
    
    # Zoek naar JSON-LD
    script_tags = soup.find_all("script", type="application/ld+json")
    for script in script_tags:
        try:
            data = json.loads(script.string)
            # Als het een product is in de JSON-LD
            if isinstance(data, dict) and data.get('@type') == 'Product':
                name = data.get('name')
                price = data.get('offers', {}).get('price')
                description = data.get('description')
                sku = data.get('sku')
                break
            # Soms zit product in een @graph
            elif isinstance(data, dict) and '@graph' in data:
                for item in data['@graph']:
                    if item.get('@type') == 'Product':
                        name = item.get('name')
                        price = item.get('offers', {}).get('price')
                        description = item.get('description')
                        sku = item.get('sku')
                        break
        except (json.JSONDecodeError, TypeError, KeyError, AttributeError):
            continue
    
    # Fallback: HTML extraheren als JSON-LD niet werkte
    if not name:
        title_tag = soup.find("title")
        if title_tag:
            name = title_tag.text.strip()
            # Verwijder eventuele " - Nootje" achtervoegsel
            name = re.sub(r'\s*[-|]\s*Nootje.*$', '', name)
    
    # --- 2. Prijs (fallback via HTML) ---
    if not price:
        # Zoek naar prijs in HTML
        price_selectors = [
            '.price',
            '.woocommerce-Price-amount',
            '.product-price',
            'span.woocommerce-Price-amount'
        ]
        for selector in price_selectors:
            elem = soup.select_one(selector)
            if elem:
                price_text = elem.get_text(strip=True)
                # Extraheer getal uit prijs (bijv. "€4,54" -> "4.54")
                match = re.search(r'[\d,]+', price_text)
                if match:
                    price = match.group().replace(',', '.')
                    break
    
    # --- 3. Categorieën ---
    # Zoek naar breadcrumb of categorie-links
    breadcrumb = soup.select_one('.woocommerce-breadcrumb')
    if breadcrumb:
        for a in breadcrumb.find_all('a'):
            cat_text = a.get_text(strip=True)
            if cat_text and cat_text not in ['Home', 'Webshop']:
                categories.append(cat_text)
    
    # --- 4. Beschrijving ---
    if not description:
        desc_elem = soup.select_one('.woocommerce-product-details__short-description, .product-description, .description')
        if desc_elem:
            description = desc_elem.get_text(strip=True)
    
    return {
        "url": url,
        "name": name or "Onbekend",
        "price": price,
        "description": description,
        "sku": sku,
        "categories": categories
    }

def get_all_product_urls():
    """
    Verzamel alle product-URL's door de webshop en alle categoriepagina's te doorlopen.
    """
    all_product_urls = set()
    
    # --- 1. Start bij de webshop ---
    print("📄 Webshop doorzoeken...")
    current_url = urljoin(BASE_URL, "/webshop/")
    page_num = 1
    
    while current_url:
        print(f"   📄 Pagina {page_num}: {current_url}")
        html = fetch_html(current_url)
        if not html:
            break
        
        # Extraheer productlinks van deze pagina
        product_links = extract_product_links_from_page(html, BASE_URL)
        all_product_urls.update(product_links)
        print(f"      → {len(product_links)} producten gevonden op deze pagina")
        
        # Ga naar de volgende pagina
        current_url = extract_pagination_links(html, BASE_URL)
        page_num += 1
        time.sleep(REQUEST_DELAY)
    
    # --- 2. Aanvullend: categoriepagina's (voor de zekerheid) ---
    # Sommige producten staan mogelijk niet in de webshop-overzicht, maar wel in categorieën.
    # We kunnen de categorieën ophalen van de webshop-pagina.
    print("\n📂 Categorieën extraheren van webshop...")
    html = fetch_html(urljoin(BASE_URL, "/webshop/"))
    if html:
        soup = BeautifulSoup(html, "html.parser")
        # Zoek naar categorie-links
        for a in soup.find_all("a", href=True):
            href = a['href']
            if '/product-categorie/' in href:
                cat_url = urljoin(BASE_URL, href)
                print(f"   📂 Categorie: {cat_url}")
                cat_html = fetch_html(cat_url)
                if cat_html:
                    cat_products = extract_product_links_from_page(cat_html, BASE_URL)
                    all_product_urls.update(cat_products)
                    print(f"      → {len(cat_products)} producten in deze categorie")
                time.sleep(REQUEST_DELAY)
    
    return all_product_urls

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("🦈 Nootje.eu Scraper")
    print("=" * 50)
    
    # 1. Verzamel alle product-URL's
    print("\n🔍 Product-URL's verzamelen...")
    product_urls = get_all_product_urls()
    print(f"\n✅ {len(product_urls)} unieke product-URL's gevonden.")
    
    if not product_urls:
        print("❌ Geen producten gevonden! Controleer de URL.")
        return
    
    # 2. Scrape alle producten
    print("\n💰 Producten ophalen...")
    products = []
    for i, url in enumerate(sorted(product_urls), 1):
        print(f"   [{i}/{len(product_urls)}] {url}")
        html = fetch_html(url)
        if html:
            product_data = parse_product_page(html, url)
            if product_data:
                products.append(product_data)
                price_display = f"€{product_data['price']}" if product_data['price'] else "N/A"
                print(f"      ✅ {product_data['name']} - {price_display}")
            else:
                print(f"      ⚠️ Kon geen data extraheren.")
        else:
            print(f"      ❌ Kon pagina niet ophalen.")
        time.sleep(REQUEST_DELAY)
    
    # 3. Opslaan als JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    
    # 4. Samenvatting
    print("\n" + "=" * 50)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")
    
    # Toon een paar voorbeelden
    if products:
        print("\n📦 Voorbeelden:")
        for p in products[:5]:
            print(f"   - {p['name']}: €{p['price'] if p['price'] else 'N/A'}")

if __name__ == "__main__":
    main()