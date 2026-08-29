import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin

# =============================================================================
# CONFIGURATIE
# =============================================================================
BASE_URL = "https://www.basboernoten.nl"
OUTPUT_FILE = "basboer_producten.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

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
    except Exception as e:
        print(f"❌ Fout bij ophalen {url}: {e}")
        return None

def parse_product_page(html, url):
    """Extraheer productinformatie van een productpagina."""
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Productnaam (titel)
    title_tag = soup.find("title")
    name = title_tag.text.strip() if title_tag else "Onbekend"
    
    # 2. Prijs (uit JSON-LD)
    price = None
    script_tags = soup.find_all("script", type="application/ld+json")
    for script in script_tags:
        try:
            data = json.loads(script.string)
            if "product" in str(data).lower():
                # Doorzoek de JSON-structuur naar de prijs
                if "offers" in data and "price" in data["offers"]:
                    price = data["offers"]["price"]
                    break
                elif "price" in data:
                    price = data["price"]
                    break
        except (json.JSONDecodeError, TypeError, KeyError):
            continue

    # 3. Valideer of het een productpagina is (heeft een prijs)
    if price is None:
        return None
        
    return {
        "url": url,
        "name": name,
        "price": price
    }

def get_all_category_links(html, base_url):
    """Vind alle categorie-links op een pagina (bijv. de homepage)."""
    soup = BeautifulSoup(html, "html.parser")
    category_links = set()
    
    # Zoek naar links die naar een categorie lijken te verwijzen
    for a in soup.find_all("a", href=True):
        href = a['href']
        # OpenCart categorieën hebben vaak /categorie/ in de URL
        if href.startswith('/') and not href.startswith(('/index.php', '/catalog', '/image', '/javascript')):
            full_url = urljoin(base_url, href)
            # Filter op basis van bekende categorie-paden
            if any(part in href for part in ['/noten', '/pitten-zaden', '/gedroogd-fruit', '/chocolade', '/muesli-granen', '/bakproducten']):
                category_links.add(full_url)
    
    return category_links

def get_product_links_from_category(html, base_url):
    """Vind alle productlinks op een categoriepagina."""
    soup = BeautifulSoup(html, "html.parser")
    product_links = set()
    
    # Zoek naar links die naar een product lijken te verwijzen
    # OpenCart producten hebben vaak een URL zoals /categorie/subcategorie/product-slug
    for a in soup.find_all("a", href=True):
        href = a['href']
        if href.startswith('/') and not href.startswith(('/index.php', '/catalog', '/image', '/javascript')):
            # Een productlink heeft meestal meerdere '/' tekens
            if href.count('/') >= 2:
                full_url = urljoin(base_url, href)
                product_links.add(full_url)
    
    return product_links

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("🦈 Bas Boer Noten Scraper")
    print("=" * 50)
    
    # 1. Start op de homepage
    print("📄 Homepage ophalen...")
    homepage_html = fetch_html(BASE_URL)
    if not homepage_html:
        return
    
    # 2. Vind alle categorie-links
    print("🔍 Categorieën zoeken...")
    category_urls = get_all_category_links(homepage_html, BASE_URL)
    print(f"   → {len(category_urls)} categorieën gevonden.")
    
    # 3. Verzamel alle product-URL's
    all_product_urls = set()
    for cat_url in category_urls:
        print(f"📂 Categorie doorzoeken: {cat_url}")
        cat_html = fetch_html(cat_url)
        if cat_html:
            product_links = get_product_links_from_category(cat_html, BASE_URL)
            all_product_urls.update(product_links)
            print(f"   → {len(product_links)} producten gevonden in deze categorie.")
        time.sleep(0.5)  # Wees vriendelijk voor de server
    
    print(f"\n🔍 Totaal {len(all_product_urls)} unieke product-URL's gevonden.")
    
    # 4. scrape alle producten
    products = []
    for i, url in enumerate(all_product_urls, 1):
        print(f"📦 [{i}/{len(all_product_urls)}] {url}")
        html = fetch_html(url)
        if html:
            product_data = parse_product_page(html, url)
            if product_data:
                products.append(product_data)
                print(f"   ✅ {product_data['name']} - €{product_data['price']}")
            else:
                print(f"   ⚠️ Geen prijs gevonden (mogelijk geen productpagina).")
        time.sleep(0.5)
    
    # 5. Opslaan als JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 50)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")

if __name__ == "__main__":
    main()