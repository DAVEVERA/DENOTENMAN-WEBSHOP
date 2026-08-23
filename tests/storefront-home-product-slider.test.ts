import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HOME_SLIDER_DEFINITIONS,
  resolveHomeSliderProducts,
  wrapHomeSliderIndex,
  type OfferedHomeSliderProduct,
} from "../lib/home-product-slider";

function offered(sku: string, name: string): OfferedHomeSliderProduct {
  return {
    id: `id-${sku}`,
    sku,
    slug: name.toLowerCase(),
    href: `/nl/producten/${name.toLowerCase()}`,
    name,
    shortDescription: null,
    categoryName: null,
    priceCents: 500,
    regularPriceCents: 500,
    salePriceCents: null,
    hasVariablePrice: false,
    defaultVariant: null,
  };
}

test("the curated slider contract uses each local image and stable SKU exactly once", () => {
  assert.equal(HOME_SLIDER_DEFINITIONS.length, 13);
  assert.equal(new Set(HOME_SLIDER_DEFINITIONS.map((item) => item.sku)).size, 13);
  assert.equal(new Set(HOME_SLIDER_DEFINITIONS.map((item) => item.imageSrc)).size, 13);

  for (const item of HOME_SLIDER_DEFINITIONS) {
    assert.match(item.imageSrc, /^\/product4slider\/[a-z]+\.png$/);
    assert.ok(item.imageWidth > 0 && item.imageHeight > 0);
  }
});

test("only offered products are returned and the curated visual order wins", () => {
  const products = resolveHomeSliderProducts([
    offered("PIT-7003-100-P", "Pijnboompitten"),
    offered("FRU-4018-250-P", "Abrikozen"),
    offered("UNKNOWN", "Niet aanbieden"),
  ]);

  assert.deepEqual(products.map((product) => product.name), ["Abrikozen", "Pijnboompitten"]);
  assert.deepEqual(products.map((product) => product.imageSrc), [
    "/product4slider/abrikozen.png",
    "/product4slider/pijnboompitten.png",
  ]);
});

test("carousel index wrapping is stable in both directions", () => {
  assert.equal(wrapHomeSliderIndex(13, 13), 0);
  assert.equal(wrapHomeSliderIndex(-1, 13), 12);
  assert.equal(wrapHomeSliderIndex(0, 0), 0);
});

test("the homepage fetches one server-side slider DTO list and removes the old hotspot hero", async () => {
  const pageSource = await readFile("app/[locale]/page.tsx", "utf8");
  const querySource = await readFile("lib/home-product-slider.server.ts", "utf8");

  assert.match(pageSource, /getHomeSliderProducts\(locale\)/);
  assert.match(pageSource, /products=\{heroProducts\}/);
  assert.doesNotMatch(pageSource, /getHeroProductHotspots|heroHotspots|FeaturedBanner/);
  assert.match(querySource, /sku:\s*\{ in: HOME_SLIDER_SKUS \}/);
  assert.match(querySource, /isActive:\s*true/);
  assert.doesNotMatch(querySource, /findUnique|findFirst/);
});

test("the client carousel exposes infinite motion, swipe, keyboard and existing cart actions", async () => {
  const [componentSource, styles] = await Promise.all([
    readFile("components/home/HomeProductSlider.tsx", "utf8"),
    readFile("components/home/HomeProductSlider.module.css", "utf8"),
  ]);

  assert.match(componentSource, /\[0, 1, 2\]/);
  assert.match(componentSource, /requestAnimationFrame/);
  assert.match(componentSource, /onPointerMove=\{handlePointerMove\}/);
  assert.match(componentSource, /onScroll=\{handleScroll\}/);
  assert.match(componentSource, /viewportCenter < setWidth/);
  assert.match(componentSource, /setOffset \* setWidthRef\.current/);
  assert.match(componentSource, /ArrowLeft/);
  assert.doesNotMatch(componentSource, /styles\.hint|styles\.controls/);
  assert.match(componentSource, /ChevronLeft/);
  assert.match(componentSource, /ChevronRight/);
  assert.match(componentSource, /\bPause\b/);
  assert.match(componentSource, /\bPlay\b/);
  assert.match(componentSource, /isManuallyPaused/);
  assert.match(componentSource, /!activeProduct && !isReducedMotion && products\.length > 1/);
  assert.match(componentSource, /aria-pressed=\{isManuallyPaused\}/);
  assert.doesNotMatch(componentSource, /isPointerInside/);
  assert.match(componentSource, /event\.pointerType === "mouse" && canHoverRef\.current/);
  assert.doesNotMatch(componentSource, /onMouseEnter|onMouseLeave/);
  assert.match(componentSource, /onPointerEnter/);
  assert.match(componentSource, /addCartItem/);
  assert.match(componentSource, /cartPath\(locale\)/);
  assert.match(componentSource, /copy\.continueShopping/);
  assert.match(componentSource, /aria-modal=\{isModal \? true : undefined\}/);
  assert.match(styles, /min-height:\s*2\.75rem/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /width:\s*min\(22rem, calc\(100% - 2rem\)\)/);
  assert.match(styles, /\.mobileControl[\s\S]*?width:\s*2\.75rem[\s\S]*?height:\s*2\.75rem/);
  assert.match(styles, /@media \(max-width:\s*1023px\)/);
  assert.match(styles, /\.mobileControls\s*\{[\s\S]*?display:\s*block/);
  assert.match(styles, /\.previousControl\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media \(max-width:\s*1023px\)[\s\S]*?\.previousControl,[\s\S]*?\.nextControl[\s\S]*?display:\s*flex/);
});
