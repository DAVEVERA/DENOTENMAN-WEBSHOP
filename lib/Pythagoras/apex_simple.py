#!/usr/bin/env python3
"""
🦈 APEX PREDATOR - SITEMAP CRAWLER
Gebruik de product-sitemap om alle product-URL's te vinden.
"""

import requests
import json
import re
import time
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# =============================================================================
# CONFIGURATIE
# =============================================================================
TARGET_URL = "https://www.noten.nl"
OUTPUT_FILE = f"scan_{time.strftime('%Y%m%d_%H%M%S')}.json"
MAX_PRODUCTS = 500
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"

# =============================================================================
# FUNCTIES
# =============================================================================


def fetch(url):
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            return response.text
        else:
            print(f"⚠️ HTTP {response.status_code} - {url}")
            return None
    except Exception as e:
        print(f"❌ Fout bij {url}: {e}")
        return None


def parse_sitemap(content):
    """Parse XML sitemap naar URLs."""
    urls = []
    try:
        soup = BeautifulSoup(content, "lxml-xml")
        for loc in soup.find_all("loc"):
            u = loc.get_text(strip=True)
            if u.startswith("http"):
                urls.append(u)
    except Exception as e:
        print(f"⚠️ Sitemap parse fout: {e}")
        # Fallback regex
        matches = re.findall(r"<loc>(.*?)</loc>", content, re.IGNORECASE)
        urls = [m for m in matches if m.startswith("http")]
    return urls


def extract_product_info(html, url):
    soup = BeautifulSoup(html, "html.parser")

    # Naam
    name = None
    for selector in ["h1", ".product-title", ".product-name", '[itemprop="name"]']:
        elem = soup.select_one(selector)
        if elem:
            name = elem.get_text(strip=True)
            break
    if not name:
        title = soup.find("title")
        if title:
            name = re.sub(r"\s*[|–-]\s*.*$", "", title.get_text(strip=True))

    # Prijs
    price = None
    price_selectors = [
        ".product-price",
        ".price",
        ".current-price",
        ".sale-price",
        ".product__price",
        ".price-amount",
        ".price-value",
        '[itemprop="price"]',
    ]
    for selector in price_selectors:
        elem = soup.select_one(selector)
        if elem:
            if elem.name == "meta":
                price_text = elem.get("content")
            else:
                price_text = elem.get_text(strip=True)
            if price_text:
                match = re.search(r"[\d.,]+", price_text)
                if match:
                    price = match.group()
                    break

    return {"name": name, "price": price, "url": url}


# =============================================================================
# MAIN
# =============================================================================


def main():
    print(r"""
    ╔═══════════════════════════════════════════════════════╗
    ║   🦈 APEX PREDATOR - SITEMAP CRAWLER                 ║
    ║   Gebruikt product-sitemap voor maximale dekking    ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    print(f"🎯 Target: {TARGET_URL}")
    print(f"📄 Output: {OUTPUT_FILE}")
    print(f"📦 Max producten: {MAX_PRODUCTS}")
    print("=" * 60)

    # Stap 1: Haal de sitemap index op
    print("📄 Sitemap index ophalen...")
    sitemap_index_url = urljoin(TARGET_URL, "/sitemap.xml")
    index_content = fetch(sitemap_index_url)
    if not index_content:
        print("❌ Geen sitemap index gevonden!")
        return

    # Parse de sitemap index
    sitemap_urls = parse_sitemap(index_content)
    print(f"   → {len(sitemap_urls)} sitemaps gevonden")

    # Stap 2: Verzamel alle product-URL's uit alle sitemaps
    product_urls = set()
    for sitemap_url in sitemap_urls:
        print(f"📄 Sitemap: {sitemap_url[:60]}...")
        content = fetch(sitemap_url)
        if content:
            urls = parse_sitemap(content)
            # Filter product-URL's (bevatten /noten/, /gedroogd-fruit/, /p/, etc.)
            for u in urls:
                # Alleen productpagina's (geen categorie, tags, etc.)
                if any(
                    pat in u
                    for pat in [
                        "/noten/",
                        "/gedroogd-fruit/",
                        "/p/",
                        "/product/",
                        "/item/",
                    ]
                ):
                    product_urls.add(u)
            print(
                f"      → {len(urls)} URLs, waarvan {len([u for u in urls if any(pat in u for pat in ['/noten/', '/gedroogd-fruit/', '/p/', '/product/', '/item/'])])} producten"
            )

    print(f"\n🔍 {len(product_urls)} product-URL's gevonden in sitemaps")

    # Stap 3: Scrape producten
    if not product_urls:
        print("❌ Geen producten gevonden! Probeer een andere URL.")
        return

    products = []
    product_list = list(product_urls)[:MAX_PRODUCTS]
    print(f"\n💰 Producten ophalen ({len(product_list)} stuks)...")
    for i, url in enumerate(product_list, 1):
        print(f"   {i}/{len(product_list)}: {url[:60]}...", end=" ", flush=True)
        html = fetch(url)
        if html:
            data = extract_product_info(html, url)
            if data:
                products.append(data)
                price_display = f"€{data['price']}" if data["price"] else "N/A"
                print(f"✅ {data['name'] or 'Onbekend'} - {price_display}")
            else:
                print("❌ Geen data")
        else:
            print("❌ Fetch mislukt")
        time.sleep(0.5)

    # Opslaan
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
