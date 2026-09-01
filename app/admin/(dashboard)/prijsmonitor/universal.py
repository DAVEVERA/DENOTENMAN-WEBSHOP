#!/usr/bin/env python3
"""
🦈 APEX UNIVERSAL SCRAPER - Notenwebshops
Scrapt producten en prijzen van:
- basboernoten.nl (OpenCart)
- nootje.eu (WooCommerce)
- noototheek.nl (Shopify)
- denotenkoerier.nl (Custom)
Gebruikt parallelle agents, adaptieve selectors en eenheidsprijsberekening.
"""

import asyncio
import aiohttp
import json
import re
import time
from typing import Dict, List, Optional, Set, Any
from urllib.parse import urljoin, urlparse
from dataclasses import dataclass, field
from bs4 import BeautifulSoup
import logging

# =============================================================================
# CONFIGURATIE
# =============================================================================

SITES = {
    "basboer": {
        "base_url": "https://www.basboernoten.nl",
        "platform": "opencart",
        "categories": ["/noten", "/pitten-zaden", "/gedroogd-fruit", "/chocolade", "/muesli-granen", "/bakproducten"],
        "max_pages_per_category": 3,
    },
    "nootje": {
        "base_url": "https://nootje.eu",
        "platform": "woocommerce",
        "shop_url": "/webshop/",
        "max_pages": 5,
    },
    "noototheek": {
        "base_url": "https://noototheek.nl",
        "platform": "shopify",
        "collection": "/collections/all/products.json",
        "limit": 250,
    },
    "denotenkoerier": {
        "base_url": "https://www.denotenkoerier.nl",
        "platform": "custom",
        "categories": ["/noten", "/pindas", "/gedroogd-fruit"],
        "max_pages_per_category": 3,
    }
}

OUTPUT_FILE = "universele_noten_producten.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CONCURRENT_REQUESTS = 10
REQUEST_DELAY = 0.5

# =============================================================================
# LOGGING
# =============================================================================

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("apex_universal")

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Product:
    url: str
    name: str
    price: Optional[float] = None
    unit_price: Optional[float] = None   # prijs per kg/liter
    currency: str = "EUR"
    sku: Optional[str] = None
    categories: List[str] = field(default_factory=list)
    variants: List[Dict] = field(default_factory=list)
    platform: str = "unknown"
    scraped_at: float = field(default_factory=time.time)

# =============================================================================
# ADAPTIVE SELECTOR ENGINE
# =============================================================================

class AdaptiveSelector:
    """Leert welke CSS-selectors werken voor een bepaald platform."""
    def __init__(self):
        self.selectors = {
            "opencart": {
                "price": ['.price', '.product-price', '.price-new', '[itemprop="price"]'],
                "name": ['h1', '.product-title', '.product-name'],
                "variants": ['.variant', '.option', '.product-options'],
            },
            "woocommerce": {
                "price": ['.price', '.woocommerce-Price-amount', '.product-price'],
                "name": ['h1.product_title', '.product-title'],
                "variants": ['.variations', '.single_variation'],
            },
            "shopify": {
                "price": ['.price', '.product__price', '.product-price'],
                "name": ['h1', '.product-title'],
                "variants": ['.product-form__input', '.product-variants'],
            },
            "custom": {
                "price": ['.price', '.product-price', '.current-price', '[itemprop="price"]'],
                "name": ['h1', '.product-title', '.product-name'],
                "variants": [],
            }
        }
        self.cache = {}

    def get(self, platform: str, field: str) -> List[str]:
        return self.selectors.get(platform, {}).get(field, [])

    def learn(self, platform: str, field: str, successful_selector: str):
        """Voeg een werkende selector toe (voor toekomstige runs)."""
        if platform not in self.selectors:
            self.selectors[platform] = {}
        if field not in self.selectors[platform]:
            self.selectors[platform][field] = []
        if successful_selector not in self.selectors[platform][field]:
            self.selectors[platform][field].insert(0, successful_selector)  # prioriteit

selector_engine = AdaptiveSelector()

# =============================================================================
# PLATFORM-SPECIFIEKE SCRAPERS
# =============================================================================

class BaseScraper:
    def __init__(self, base_url: str, platform: str, session: aiohttp.ClientSession):
        self.base_url = base_url
        self.platform = platform
        self.session = session
        self.products = []
        self.seen_urls = set()
        self.selector = selector_engine

    async def fetch_html(self, url: str) -> Optional[str]:
        """Haal HTML op met retry."""
        headers = {"User-Agent": USER_AGENT}
        for attempt in range(3):
            try:
                async with self.session.get(url, headers=headers, timeout=15) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    elif resp.status == 429:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        logger.warning(f"HTTP {resp.status} voor {url}")
                        return None
            except Exception as e:
                logger.error(f"Fout bij ophalen {url}: {e}")
                await asyncio.sleep(1)
        return None

    async def fetch_json(self, url: str) -> Optional[Dict]:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        try:
            async with self.session.get(url, headers=headers, timeout=15) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            logger.error(f"JSON-fout bij {url}: {e}")
        return None

    def extract_price_from_soup(self, soup: BeautifulSoup) -> Optional[float]:
        """Probeer prijs te extraheren via JSON-LD en fallback selectors."""
        # 1. JSON-LD
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    if data.get('@type') == 'Product':
                        offers = data.get('offers', {})
                        price = offers.get('price')
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

        # 2. HTML selectors (adaptief)
        for selector in self.selector.get(self.platform, 'price'):
            elem = soup.select_one(selector)
            if elem:
                price_text = elem.get_text(strip=True)
                match = re.search(r'[\d.,]+', price_text)
                if match:
                    price_str = match.group().replace(',', '.')
                    try:
                        return float(price_str)
                    except:
                        pass
        return None

    def extract_name(self, soup: BeautifulSoup) -> str:
        for selector in self.selector.get(self.platform, 'name'):
            elem = soup.select_one(selector)
            if elem:
                name = elem.get_text(strip=True)
                if name:
                    return name
        title = soup.find("title")
        if title:
            return title.get_text(strip=True)
        return "Onbekend"

    def extract_unit_price(self, text: str, price: float) -> Optional[float]:
        """Probeer eenheidsprijs te berekenen uit tekst (bijv. '250 gram')."""
        weight_match = re.search(r'(\d+)\s*(gram|g|kg)', text, re.IGNORECASE)
        if weight_match:
            amount = float(weight_match.group(1))
            unit = weight_match.group(2).lower()
            kg = amount / 1000 if unit in ['gram', 'g'] else amount
            if kg > 0:
                return round(price / kg, 2)
        return None

    async def scrape_product_page(self, url: str) -> Optional[Product]:
        """Scrape één productpagina."""
        html = await self.fetch_html(url)
        if not html:
            return None
        soup = BeautifulSoup(html, "html.parser")
        
        name = self.extract_name(soup)
        price = self.extract_price_from_soup(soup)
        if price is None:
            return None
        
        product = Product(
            url=url,
            name=name,
            price=price,
            platform=self.platform
        )
        
        # Probeer eenheidsprijs uit beschrijving of varianten
        # Vereenvoudigd: zoek in de hele pagina naar gewichtsindicaties
        page_text = soup.get_text()
        unit_price = self.extract_unit_price(page_text, price)
        if unit_price:
            product.unit_price = unit_price
        
        return product

    async def run(self) -> List[Product]:
        raise NotImplementedError

# =============================================================================
# PLATFORM-SPECIFIEKE IMPLEMENTATIES
# =============================================================================

class OpenCartScraper(BaseScraper):
    async def run(self) -> List[Product]:
        categories = SITES["basboer"]["categories"]
        max_pages = SITES["basboer"]["max_pages_per_category"]
        
        for cat in categories:
            cat_url = urljoin(self.base_url, cat)
            logger.info(f"📂 OpenCart categorie: {cat_url}")
            for page in range(1, max_pages + 1):
                page_url = f"{cat_url}?page={page}" if page > 1 else cat_url
                html = await self.fetch_html(page_url)
                if not html:
                    break
                soup = BeautifulSoup(html, "html.parser")
                product_links = set()
                for a in soup.find_all("a", href=True):
                    href = a['href']
                    if href.startswith('/') and href.count('/') >= 2:
                        full_url = urljoin(self.base_url, href)
                        if full_url not in self.seen_urls and '/cdn-cgi/' not in full_url:
                            product_links.add(full_url)
                logger.info(f"   Pagina {page}: {len(product_links)} productlinks")
                for url in product_links:
                    product = await self.scrape_product_page(url)
                    if product:
                        self.products.append(product)
                        self.seen_urls.add(url)
                        logger.info(f"   ✅ {product.name} - €{product.price:.2f}")
                await asyncio.sleep(REQUEST_DELAY)
        return self.products

class WooCommerceScraper(BaseScraper):
    async def run(self) -> List[Product]:
        shop_url = urljoin(self.base_url, SITES["nootje"]["shop_url"])
        max_pages = SITES["nootje"]["max_pages"]
        current_url = shop_url
        page_num = 1
        
        while current_url and page_num <= max_pages:
            logger.info(f"📄 WooCommerce pagina {page_num}: {current_url}")
            html = await self.fetch_html(current_url)
            if not html:
                break
            soup = BeautifulSoup(html, "html.parser")
            product_links = set()
            for a in soup.find_all("a", href=True):
                href = a['href']
                if '/product/' in href:
                    clean_url = urljoin(self.base_url, href)
                    product_links.add(clean_url)
            logger.info(f"   → {len(product_links)} producten")
            for url in product_links:
                if url not in self.seen_urls:
                    product = await self.scrape_product_page(url)
                    if product:
                        self.products.append(product)
                        self.seen_urls.add(url)
                        logger.info(f"   ✅ {product.name} - €{product.price:.2f}")
            # Volgende pagina
            next_link = None
            for a in soup.find_all("a", href=True):
                if 'next' in a.get('class', []) or 'volgende' in a.get_text().lower():
                    next_link = urljoin(self.base_url, a['href'])
                    break
            current_url = next_link
            page_num += 1
            await asyncio.sleep(REQUEST_DELAY)
        return self.products

class ShopifyScraper(BaseScraper):
    async def run(self) -> List[Product]:
        collection_url = urljoin(self.base_url, SITES["noototheek"]["collection"])
        limit = SITES["noototheek"]["limit"]
        page = 1
        
        while True:
            url = f"{collection_url}?page={page}&limit={limit}"
            logger.info(f"📄 Shopify pagina {page}: {url}")
            data = await self.fetch_json(url)
            if not data or not data.get('products'):
                break
            for pdata in data['products']:
                handle = pdata.get('handle')
                if not handle:
                    continue
                product_url = urljoin(self.base_url, f"/products/{handle}")
                if product_url in self.seen_urls:
                    continue
                # Parse product uit JSON
                title = pdata.get('title', 'Onbekend')
                variants = pdata.get('variants', [])
                product = Product(
                    url=product_url,
                    name=title,
                    platform=self.platform,
                    variants=variants
                )
                # Prijs uit eerste variant
                if variants and variants[0].get('price'):
                    price = float(variants[0]['price'])
                    product.price = price
                    # Eenheidsprijs proberen
                    for v in variants:
                        option_text = v.get('option1', '') + v.get('option2', '') + v.get('option3', '')
                        unit_price = self.extract_unit_price(option_text, price)
                        if unit_price:
                            product.unit_price = unit_price
                            break
                    self.products.append(product)
                    self.seen_urls.add(product_url)
                    logger.info(f"   ✅ {title} - €{price:.2f}")
            if len(data['products']) < limit:
                break
            page += 1
            await asyncio.sleep(REQUEST_DELAY)
        return self.products

class CustomScraper(BaseScraper):
    async def run(self) -> List[Product]:
        categories = SITES["denotenkoerier"]["categories"]
        max_pages = SITES["denotenkoerier"]["max_pages_per_category"]
        
        for cat in categories:
            cat_url = urljoin(self.base_url, cat)
            logger.info(f"📂 Custom categorie: {cat_url}")
            for page in range(1, max_pages + 1):
                page_url = f"{cat_url}?page={page}" if page > 1 else cat_url
                html = await self.fetch_html(page_url)
                if not html:
                    break
                soup = BeautifulSoup(html, "html.parser")
                product_links = set()
                for a in soup.find_all("a", href=True):
                    href = a['href']
                    if '/noten' in href or '/pindas' in href:
                        full_url = urljoin(self.base_url, href)
                        if full_url not in self.seen_urls and full_url != cat_url:
                            product_links.add(full_url)
                logger.info(f"   Pagina {page}: {len(product_links)} links")
                for url in product_links:
                    product = await self.scrape_product_page(url)
                    if product:
                        self.products.append(product)
                        self.seen_urls.add(url)
                        logger.info(f"   ✅ {product.name} - €{product.price:.2f}")
                await asyncio.sleep(REQUEST_DELAY)
        return self.products

# =============================================================================
# SCRAPER MANAGER
# =============================================================================

class ScraperManager:
    def __init__(self):
        self.session = None
        self.all_products = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def get_scraper(self, site_name: str) -> BaseScraper:
        config = SITES[site_name]
        base_url = config["base_url"]
        platform = config["platform"]
        if platform == "opencart":
            return OpenCartScraper(base_url, platform, self.session)
        elif platform == "woocommerce":
            return WooCommerceScraper(base_url, platform, self.session)
        elif platform == "shopify":
            return ShopifyScraper(base_url, platform, self.session)
        elif platform == "custom":
            return CustomScraper(base_url, platform, self.session)
        else:
            raise ValueError(f"Onbekend platform: {platform}")

    async def scrape_site(self, site_name: str) -> List[Product]:
        scraper = self.get_scraper(site_name)
        products = await scraper.run()
        return products

    async def scrape_all(self) -> List[Product]:
        tasks = []
        for site_name in SITES.keys():
            tasks.append(self.scrape_site(site_name))
        results = await asyncio.gather(*tasks)
        for products in results:
            self.all_products.extend(products)
        return self.all_products

# =============================================================================
# MAIN
# =============================================================================

async def main():
    print("🦈 APEX UNIVERSELE NOTENSCRAPER")
    print("=" * 60)
    
    async with ScraperManager() as manager:
        products = await manager.scrape_all()
    
    # Opslaan
    output = [p.__dict__ for p in products]
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 60)
    print(f"✅ Klaar! {len(products)} producten opgeslagen in {OUTPUT_FILE}")
    
    # Samenvatting per site
    site_counts = {}
    for p in products:
        site_counts[p.platform] = site_counts.get(p.platform, 0) + 1
    print("\n📊 Overzicht per platform:")
    for platform, count in site_counts.items():
        print(f"   - {platform}: {count} producten")

if __name__ == "__main__":
    asyncio.run(main())