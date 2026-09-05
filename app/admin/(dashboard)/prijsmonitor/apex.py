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
import argparse
from typing import Optional
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
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
REQUEST_DELAY = 0.3
MAX_RETRIES = 3
MAX_PRODUCTS_PER_SITE = 25
MAX_PAGES_PER_SITE = 40
ACTIVE_DOMAIN = None


def allowed_product_url(url):
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    domains = [ACTIVE_DOMAIN] if ACTIVE_DOMAIN else SITES
    return (parsed.scheme == "https" and parsed.port in (None, 443)
            and not parsed.username and not parsed.password
            and any(host == domain or host == "www." + domain for domain in domains))


def bounded_response(url, accept="text/html"):
    # Do not follow a competitor link to another host or download an unlimited body.
    for _ in range(4):
        if not allowed_product_url(url):
            return None
        with requests.get(url, headers={"User-Agent": USER_AGENT, "Accept": accept},
                          timeout=15, allow_redirects=False, stream=True) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            response.raise_for_status()
            chunks = []
            size = 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 2_000_000:
                    return None
                chunks.append(chunk)
            return b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    return None


def extract_unit(text):
    match = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram|ml|l|liter)\b", text, re.I)
    return match.group(0) if match else None


def calc_unit_price(price, unit):
    if not unit:
        return None
    match = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram|ml|l|liter)\s*", unit, re.I)
    if not match:
        return None
    quantity = float(match.group(1).replace(",", "."))
    if quantity <= 0:
        return None
    if match.group(2).lower() in ("g", "gram", "ml"):
        quantity /= 1000
    return round(price / quantity, 4)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Lokale prijscontrole; automatisch inladen is begrensd op maximaal 25 producten.")
    parser.add_argument("--domain", choices=[domain for domain in SITES if "." in domain])
    parser.add_argument("--limit", type=int, default=25, choices=range(1, 26))
    parser.add_argument("--max-pages", type=int, default=40, choices=range(1, 201))
    parser.add_argument("--upload-url")
    parser.add_argument("--upload-token")
    args = parser.parse_args(argv)
    if bool(args.upload_url) != bool(args.upload_token):
        parser.error("upload-url en upload-token zijn samen verplicht")
    if args.upload_url:
        destination = urlparse(args.upload_url)
        if (not args.domain or destination.scheme != "https"
                or destination.hostname not in ("denotenman.com", "www.denotenman.com")
                or destination.port not in (None, 443) or destination.username or destination.password
                or not re.fullmatch(r"/api/price-monitor/apex-local/[A-Za-z0-9_-]+", destination.path)):
            parser.error("Upload vereist een gekozen domein en de veilige De Notenman uploadroute")
    return args


def upload_results(url, upload_token, domain, products):
    response = requests.post(url, headers={"Authorization": f"Bearer {upload_token}"},
                             json={"domain": domain, "products": products}, timeout=30, allow_redirects=False)
    if response.status_code not in (200, 201, 202):
        raise RuntimeError(f"Upload mislukt (HTTP {response.status_code}); lokale resultaten zijn bewaard")

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
    for attempt in range(MAX_RETRIES):
        try:
            return bounded_response(url)
        except requests.RequestException:
            time.sleep(2**attempt)
    return None


def fetch_json(url):
    """Haal JSON op met retry."""
    for attempt in range(MAX_RETRIES):
        try:
            body = bounded_response(url, "application/json")
            return json.loads(body) if body else None
        except (requests.RequestException, ValueError):
            time.sleep(2**attempt)
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

    max_pages = MAX_PAGES_PER_SITE
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
            if not allowed_product_url(full_url):
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

    unit = extract_unit(name)
    return {"url": url, "name": name, "price": price,
            "variants": [{"title": name, "price": price, "unit": unit, "unit_price": calc_unit_price(price, unit)}]}


# =============================================================================
# MAIN
# =============================================================================


def main():
    global MAX_PRODUCTS_PER_SITE, MAX_PAGES_PER_SITE, ACTIVE_DOMAIN
    args = parse_args()
    MAX_PRODUCTS_PER_SITE = args.limit
    MAX_PAGES_PER_SITE = args.max_pages
    selected_sites = [args.domain] if args.domain else [domain for domain in SITES if "." in domain]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("""
    ╔═══════════════════════════════════════════════════════════════════╗
    ║  🦈 ULTIMATE SCRAPER v2 – ROBUUSTE PRIJSNORMALISATIE           ║
    ║  • Vindt ALTIJD producten                                       ║
    ║  • Verwerkt ALLE prijsformaten (1.234,56 / 3.252.99)           ║
    ║  • Gebruikt sitemap → API → agressieve BFS-crawl              ║
    ╚═══════════════════════════════════════════════════════════════════╝
    """)

    all_results = {}

    for domain in selected_sites:
        ACTIVE_DOMAIN = domain
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
        product_urls = {url for url in product_urls if allowed_product_url(url)}
        for i, url in enumerate(sorted(product_urls)[:MAX_PRODUCTS_PER_SITE], 1):
            print(f"   [{i}/{min(len(product_urls), MAX_PRODUCTS_PER_SITE)}] {url[:60]}...")
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
    if args.upload_url:
        upload_results(args.upload_url, args.upload_token, args.domain, all_results.get(args.domain, []))
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
