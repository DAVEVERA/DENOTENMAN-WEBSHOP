#!/usr/bin/env python3
"""
🦈 ULTIMATE SCRAPER v2 – FIXED PRICE NORMALIZATION
Vindt ALTIJD producten, ongeacht het prijsformaat.
"""

import os
import sys
import json
import re
import time
import csv
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from datetime import datetime

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

OUTPUT_DIR = "ultimate_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 0.3
MAX_RETRIES = 3

# =============================================================================
# PRIJSNORMALISATIE – ROBUUST
# =============================================================================


def normalize_price(price_text: str) -> Optional[float]:
    """
    Converteer een prijsstring naar een float, ongeacht het formaat.
    Ondersteunt: '€ 1.234,56', '€ 1234.56', '3.252.99', '1,234.56', etc.
    """
    if not price_text:
        return None

    # 1. Verwijder alle niet-getal tekens (behalve punt en komma)
    cleaned = re.sub(r"[^\d.,]", "", price_text.strip())

    if not cleaned:
        return None

    # 2. Bepaal de scheidingstekens
    has_comma = "," in cleaned
    has_dot = "." in cleaned

    # 3. Geen scheidingstekens -> gewoon getal
    if not has_comma and not has_dot:
        try:
            return float(cleaned)
        except:
            return None

    # 4. Alleen komma -> vervang door punt (decimaal)
    if has_comma and not has_dot:
        try:
            return float(cleaned.replace(",", "."))
        except:
            return None

    # 5. Alleen punt -> complex
    if has_dot and not has_comma:
        parts = cleaned.split(".")
        # Als er meer dan 2 delen zijn, is de punt een duizendtal-scheiding
        if len(parts) > 2:
            # Laatste deel is decimaal, de rest is duizendtal
            decimal = parts[-1]
            thousands = "".join(parts[:-1])
            combined = f"{thousands}.{decimal}"
            try:
                return float(combined)
            except:
                # Fallback: probeer alle punten te vervangen
                try:
                    return float(cleaned.replace(".", ""))
                except:
                    return None
        else:
            # Eén punt -> waarschijnlijk decimaal
            try:
                return float(cleaned)
            except:
                return None

    # 6. Zowel komma als punt
    if has_comma and has_dot:
        # Bepaal welke de decimaal is: als de komma de laatste separator is
        last_comma = cleaned.rfind(",")
        last_dot = cleaned.rfind(".")
        if last_comma > last_dot:
            # Komma is de decimaal (Europees formaat: 1.234,56)
            thousands = cleaned[:last_comma].replace(".", "")
            decimal = cleaned[last_comma + 1 :]
            combined = f"{thousands}.{decimal}"
        else:
            # Punt is de decimaal (VS-formaat: 1,234.56)
            thousands = cleaned[:last_dot].replace(",", "")
            decimal = cleaned[last_dot + 1 :]
            combined = f"{thousands}.{decimal}"
        try:
            return float(combined)
        except:
            return None

    return None


# =============================================================================
# FETCH FUNCTIES
# =============================================================================


def fetch(url):
    """Haal HTML op met retry."""
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 429:
                time.sleep(2**attempt)
            else:
                return None
        except:
            time.sleep(1)
    return None


def fetch_json(url):
    """Haal JSON op met retry."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                time.sleep(2**attempt)
            else:
                return None
        except:
            time.sleep(1)
    return None


# =============================================================================
# PRODUCT-URL DETECTIE
# =============================================================================


def is_product_url(url):
    """Check of een URL een productpagina is."""
    url_lower = url.lower()
    if any(
        x in url_lower
        for x in ["/product/", "/p/", "/item/", "/products/", "/artikel/"]
    ):
        return True
    if "route=product/product" in url_lower:
        return True
    if "product_id=" in url_lower:
        return True
    if "sku=" in url_lower:
        return True
    patterns = [
        r"/noten/[a-z0-9\-]+",
        r"/gedroogd-fruit/[a-z0-9\-]+",
        r"/pindas/[a-z0-9\-]+",
        r"/chocolade/[a-z0-9\-]+",
        r"/snoep/[a-z0-9\-]+",
        r"/cadeaus/[a-z0-9\-]+",
        r"/amandelen",
        r"/cashewnoten",
        r"/walnoten",
        r"/hazelnoten",
        r"/pecannoten",
        r"/macadamianoten",
        r"/pistachenoten",
        r"/rozijnen",
        r"/abrikozen",
        r"/pasta",
        r"/muesli",
        r"/granen",
        r"/pitten",
        r"/zaden",
    ]
    for pattern in patterns:
        if re.search(pattern, url_lower):
            return True
    return False


# =============================================================================
# PRODUCT-URL VERZAMELEN
# =============================================================================


def get_products_from_sitemap(base_url):
    """Haal product-URL's uit sitemap.xml."""
    urls = set()
    sitemap_paths = [
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/sitemap-products.xml",
        "/sitemap_product_1.xml",
        "/sitemap_products.xml",
        "/sitemap/sitemap.xml",
    ]
    for path in sitemap_paths:
        full_url = urljoin(base_url, path)
        print(f"   📄 Sitemap test: {full_url}")
        content = fetch(full_url)
        if content and ("<urlset" in content or "<sitemapindex" in content):
            print(f"      ✅ Sitemap gevonden!")
            try:
                soup = BeautifulSoup(content, "lxml-xml")
                for loc in soup.find_all("loc"):
                    url = loc.get_text(strip=True)
                    if is_product_url(url):
                        urls.add(url)
            except:
                # Fallback: regex
                matches = re.findall(r"<loc>(.*?)</loc>", content, re.IGNORECASE)
                for url in matches:
                    if is_product_url(url):
                        urls.add(url)
            break
    return urls


def get_products_from_shopify_api(base_url):
    """Haal product-URL's via Shopify JSON API."""
    urls = set()
    json_url = urljoin(base_url, "/products.json?limit=250")
    print(f"   📄 Shopify API test: {json_url}")
    data = fetch_json(json_url)
    if data and "products" in data:
        print(f"      ✅ Shopify API werkt! {len(data['products'])} producten")
        for p in data["products"]:
            handle = p.get("handle")
            if handle:
                urls.add(urljoin(base_url, f"/products/{handle}"))
    return urls


def get_products_from_woocommerce_api(base_url):
    """Haal product-URL's via WooCommerce REST API."""
    urls = set()
    endpoints = [
        "/wp-json/wc/v3/products",
        "/wp-json/wc/v2/products",
    ]
    for endpoint in endpoints:
        json_url = urljoin(base_url, f"{endpoint}?per_page=100")
        print(f"   📄 WooCommerce API test: {json_url}")
        data = fetch_json(json_url)
        if data and isinstance(data, list):
            print(f"      ✅ WooCommerce API werkt! {len(data)} producten")
            for p in data:
                permalink = p.get("permalink")
                if permalink:
                    urls.add(permalink)
            break
    return urls


def get_products_by_crawling(base_url):
    """Agressieve BFS-crawl om product-URL's te vinden."""
    print(f"   🔍 Start agressieve BFS-crawl...")
    product_urls = set()
    visited = set()
    to_visit = [base_url]
    for path in [
        "/noten",
        "/producten",
        "/categorie",
        "/shop",
        "/webshop",
        "/assortiment",
        "/catalog",
    ]:
        to_visit.append(urljoin(base_url, path))

    max_pages = 500
    while to_visit and len(visited) < max_pages:
        url = to_visit.pop()
        if url in visited:
            continue
        visited.add(url)

        html = fetch(url)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if (
                href.startswith("#")
                or href.startswith("javascript:")
                or href.startswith("mailto:")
            ):
                continue
            full_url = urljoin(base_url, href)
            if not full_url.startswith(base_url):
                continue
            if full_url in visited:
                continue

            if is_product_url(full_url):
                product_urls.add(full_url)
            else:
                if len(to_visit) < max_pages:
                    to_visit.append(full_url)

        time.sleep(REQUEST_DELAY)

    print(
        f"      ✅ Crawl voltooid: {len(visited)} pagina's bezocht, {len(product_urls)} producten gevonden"
    )
    return product_urls


# =============================================================================
# PRODUCT SCRAPEN
# =============================================================================


def scrape_product(url):
    """Scrape productinformatie met robuuste prijsnormalisatie."""
    html = fetch(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    # 1. Naam
    name = "Onbekend"
    for sel in ["h1", ".product-title", ".product-name", ".product_title"]:
        elem = soup.select_one(sel)
        if elem:
            name = elem.get_text(strip=True)
            break
    if name == "Onbekend":
        title = soup.find("title")
        if title:
            name = title.get_text(strip=True)

    # 2. Prijs – eerst JSON-LD
    price = None
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") == "Product":
                    price_data = data.get("offers", {}).get("price")
                    if price_data:
                        price = normalize_price(str(price_data))
                        if price is not None:
                            break
                elif "@graph" in data:
                    for item in data["@graph"]:
                        if item.get("@type") == "Product":
                            price_data = item.get("offers", {}).get("price")
                            if price_data:
                                price = normalize_price(str(price_data))
                                if price is not None:
                                    break
        except:
            continue
        if price is not None:
            break

    # 3. Prijs – HTML fallback
    if price is None:
        for sel in [
            ".price",
            ".product-price",
            ".woocommerce-Price-amount",
            ".current-price",
            ".sale-price",
        ]:
            elem = soup.select_one(sel)
            if elem:
                text = elem.get_text(strip=True)
                price = normalize_price(text)
                if price is not None:
                    break

    if price is None:
        return None

    return {"url": url, "name": name, "price": price}


# =============================================================================
# MAIN
# =============================================================================


def main():
    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║  🦈 ULTIMATE SCRAPER v2 – ROBUUSTE PRIJSNORMALISATIE           ║
    ║  • Vindt ALTIJD producten                                       ║
    ║  • Verwerkt ALLE prijsformaten (1.234,56 / 3.252.99)           ║
    ║  • Gebruikt sitemap → API → agressieve BFS-crawl              ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)

    all_results = {}

    for domain in SITES:
        print(f"\n{'='*60}")
        print(f"🔄 Verwerken: {domain}")
        print(f"{'='*60}")

        base_url = f"https://{domain}"
        product_urls = set()

        # 1. Sitemap
        print("🔍 Methode 1: Sitemap")
        urls = get_products_from_sitemap(base_url)
        product_urls.update(urls)

        # 2. API
        if not product_urls:
            print("🔍 Methode 2: API")
            urls = get_products_from_shopify_api(base_url)
            product_urls.update(urls)
            if not product_urls:
                urls = get_products_from_woocommerce_api(base_url)
                product_urls.update(urls)

        # 3. Agressieve crawl
        if not product_urls:
            print("🔍 Methode 3: Agressieve BFS-crawl")
            urls = get_products_by_crawling(base_url)
            product_urls.update(urls)

        print(f"\n✅ {len(product_urls)} product-URL's gevonden voor {domain}")

        if not product_urls:
            print("   ⚠️ Geen producten gevonden voor dit domein.")
            all_results[domain] = []
            continue

        # Scrape producten
        products = []
        for i, url in enumerate(product_urls, 1):
            if i > 500:
                break
            print(f"   [{i}/{min(len(product_urls), 500)}] {url[:60]}...")
            try:
                product = scrape_product(url)
                if product:
                    products.append(product)
                    print(f"      ✅ {product['name'][:40]} - €{product['price']:.2f}")
                else:
                    print(f"      ❌ Geen prijs gevonden")
            except Exception as e:
                print(f"      ❌ Fout: {e}")
            time.sleep(REQUEST_DELAY)

        all_results[domain] = products

    # Opslaan
    output_file = os.path.join(OUTPUT_DIR, f"ultimate_scan_{TIMESTAMP}.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n📄 JSON: {output_file}")

    csv_file = os.path.join(OUTPUT_DIR, f"ultimate_scan_{TIMESTAMP}.csv")
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Domein", "Product URL", "Productnaam", "Prijs"])
        for domain, products in all_results.items():
            for p in products:
                writer.writerow([domain, p["url"], p["name"], p["price"]])
    print(f"📄 CSV: {csv_file}")

    total = sum(len(p) for p in all_results.values())
    print(f"\n✅ Klaar! Totaal {total} producten opgehaald.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Gestopt door gebruiker.")
    except Exception as e:
        print(f"\n❌ FOUT: {e}")
        import traceback

        traceback.print_exc()
        print("\nDruk op Enter om af te sluiten...")
        input()
