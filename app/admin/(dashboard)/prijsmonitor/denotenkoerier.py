"""
🦈 De Notenkoerier Scraper
Scrapt producten van denotenkoerier.nl door categoriepagina's te doorlopen.
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
BASE_URL = "https://www.denotenkoerier.nl"
OUTPUT_FILE = "denotenkoerier_producten.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 1.0  # Seconden tussen requests (vriendelijk voor de server)

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
    Extraheer alle productlinks van een overzichtspagina.
    Dit is een schatting op basis van veelvoorkomende patronen.
    """
    soup = BeautifulSoup(html, "html.parser")
    product_links = set()
    
    # Zoek naar links die waarschijnlijk naar een product verwijzen.
    # Dit is een brede zoekopdracht; je moet dit mogelijk aanpassen.
    for a in soup.find_all("a", href=True):
        href = a['href']
        # Negeer links naar categorieën, zoekopdrachten, etc.
        if '/noten' in href or '/pindas' in href or '/gedroogd-fruit' in href:
            full_url = urljoin(base_url, href)
            # Alleen interne links
            if full_url.startswith(base_url) and full_url != base_url:
                product_links.add(full_url)
    
    return product_links

def extract_pagination_links(html, base_url):
    """Extraheer de 'volgende pagina' link van een overzichtspagina."""
    soup = BeautifulSoup(html, "html.parser")
    
    # Zoek naar een link die eruitziet als 'volgende' of een paginanummer
    for a in soup.find_all("a", href=True):
        if 'volgende' in a.get_text().lower() or 'next' in a.get_text().lower():
            return urljoin(base_url, a['href'])
        # Of zoek naar een link met 'page' in de URL
        if '/page/' in a['href']:
            # Neem de laatste 'page' link als de volgende pagina
            # (Dit is een vereenvoudiging; in de praktijk moet je de huidige pagina detecteren)
            pass
    
    # Vereenvoudigde paginering: zoek naar een link met '?page='
    for a in soup.find_all("a", href=True):
        if '?page=' in a['href']:
            return urljoin(base_url, a['href'])
    
    return None

def parse_product_page(html, url):
    """
    Extraheer productinformatie van een productpagina.
    Dit is een algemene functie; je moet de selectors aanpassen op basis van de daadwerkelijke HTML.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Productnaam (titel)
    title_tag = soup.find("title")
    name = title_tag.text.strip() if title_tag else "Onbekend"
    
    # 2. Prijs (zoek naar veelvoorkomende prijs-selectors)
    price = None
    price_selectors = [
        '.price',
        '.product-price',
        '.woocommerce-Price-amount',
        'span.woocommerce-Price-amount',
        '.current-price',
        '.sale-price',
        '[itemprop="price"]',
        '.product__price'
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
    
    # 3. Valideer of het een productpagina is (heeft een prijs)
    if price is None:
        return None
        
    return {
        "url": url,
        "name": name,
        "price": price
    }

def get_all_product_urls_from_category(category_url):
    """
    Verzamel alle product-URL's van een specifieke categorie door alle pagina's te doorlopen.
    """
    all_product_urls = set()
    current_url = category_url
    page_num = 1
    
    while current_url:
        print(f"   📄 Pagina {page_num}: {current_url}")
        html = fetch_html(current_url)
        if not html:
            break
        
        # Extraheer productlinks van deze pagina
        product_links = extract_product_links_from_page(html, BASE_URL)
        all_product_urls.update(product_links)
        print(f"      → {len(product_links)} productlinks gevonden op deze pagina")
        
        # Ga naar de volgende pagina
        current_url = extract_pagination_links(html, BASE_URL)
        page_num += 1
        time.sleep(REQUEST_DELAY)
    
    return all_product_urls

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("🦈 De Notenkoerier Scraper")
    print("=" * 60)
    
    # 1. Bepaal welke categorieën je wilt scrapen.
    # Dit is een lijst van categorie-URL's die je handmatig moet invullen.
    # Je kunt deze vinden door op de website te navigeren.
    categories = [
        "/noten",
        "/pindas",
        # Voeg hier meer categorieën toe
    ]
    
    all_product_urls = set()
    for cat in categories:
        cat_url = urljoin(BASE_URL, cat)
        print(f"\n📂 Categorie doorzoeken: {cat_url}")
        product_urls = get_all_product_urls_from_category(cat_url)
        all_product_urls.update(product_urls)
        print(f"   → Totaal {len(product_urls)} producten gevonden in deze categorie.")
    
    print(f"\n🔍 Totaal {len(all_product_urls)} unieke product-URL's gevonden.")
    
    if not all_product_urls:
        print("❌ Geen producten gevonden! Controleer de categorie-URL's en de selectors.")
        return
    
    # 2. Scrape alle producten
    print("\n💰 Producten ophalen...")
    products = []
    for i, url in enumerate(sorted(all_product_urls), 1):
        print(f"   [{i}/{len(all_product_urls)}] {url}")
        html = fetch_html(url)
        if html:
            product_data = parse_product_page(html, url)
            if product_data:
                products.append(product_data)
                print(f"      ✅ {product_data['name']} - €{product_data['price']}")
            else:
                print(f"      ⚠️ Kon geen prijs extraheren (mogelijk geen productpagina).")
        else:
            print(f"      ❌ Kon pagina niet ophalen.")
        time.sleep(REQUEST_DELAY)
    
    # 3. Opslaan als JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 60)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")

if __name__ == "__main__":
    main()