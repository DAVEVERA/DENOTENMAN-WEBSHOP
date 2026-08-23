# Lepelpanorama concept preview - design QA

final result: passed

## Comparison target

- Source visual truth: `components/home/denotenman-hero-lepelpanorama/interactieve-lepelpanorama.html`
- Source asset truth: `components/home/denotenman-hero-lepelpanorama/`
- Implementation: `app/[locale]/concept/lepelpanorama/page.tsx`
- Embedded runtime: `/preview-assets/lepelpanorama/interactieve-lepelpanorama.html`
- State: initial panorama position, autoplay stopped, no product panel open

## Capture evidence

### Desktop

- CSS viewport: 1440 x 900
- Source pixels: 1440 x 900 at deviceScaleFactor 1
- Implementation pixels: 1440 x 900 at deviceScaleFactor 1
- Source capture: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\source-1440x900.png`
- Implementation capture: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\implementation-1440x900.png`
- Combined comparison: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\comparison-1440x900.png`
- Source and implementation SHA-256: `6270D0D323C36AF3100F5B9BDB1F1E816B9C6B268F10703E2EA9B8785913FD12`

### Mobile

- CSS viewport: 390 x 844
- Source pixels: 390 x 844 at deviceScaleFactor 1
- Implementation pixels: 390 x 844 at deviceScaleFactor 1
- Source capture: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\source-390x844.png`
- Implementation capture: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\implementation-390x844.png`
- Combined comparison: `C:\Users\Thinkpat\AppData\Local\Temp\denotenman-lepelpanorama-qa\comparison-390x844.png`
- Source and implementation SHA-256: `EEAF13F3394BFE68904153A02B41A3C6E4F0DCE035DB44EA590DDB5B7D910A81`

No density normalization was required. Both comparison pairs are byte-identical.

## Required fidelity surfaces

- Fonts and typography: identical because the supplied HTML and its font stack are served unchanged.
- Spacing and layout rhythm: identical at both viewports; screenshot hashes match exactly.
- Colors and visual tokens: identical source CSS and raster output; screenshot hashes match exactly.
- Image quality and asset fidelity: all five panorama tiles, forty spoon foreground layers, forty spoon backgrounds, nineteen product images and the supplied nut icon are reused directly. No image was regenerated, recompressed, resized or substituted.
- Copy and content: the supplied Dutch labels, product data, prices, controls and accessibility text are unchanged.

## Interaction evidence

- Desktop: next arrow, autoplay, pause, keyboard ArrowRight and pointer drag all changed the world transform.
- Autoplay remained stationary after pause.
- Hotspot activation opened the correct product, raised one active spoon and one neighbouring spoon, and loaded the supplied product image.
- More info, quick order, close and focus-return state changes executed.
- Mobile at 390 x 844: no horizontal document overflow; a real touch swipe moved the panorama; the product panel opened as a fixed bottom sheet with backdrop and one active spoon.
- Reduced motion: autoplay did not start and the live status explained why.
- Embedded sandbox route: 40 hotspots, 40 spoon layers and 5 panorama tiles loaded; next and product interactions executed inside the actual preview iframe.
- Browser console: no runtime exceptions, error logs or uncancelled network failures.

## Full-view and focused comparison

The desktop and mobile full-view comparisons were opened as side-by-side combined images. A separate focused crop was unnecessary because pixel equality already covers every visible region, including icon edges, spoon textures, control shapes and mobile crop.

## Findings and comparison history

- No P0, P1 or P2 visual mismatch was found.
- First production build attempt exposed an over-broad Turbopack filesystem trace. The preview file read was explicitly excluded from deployment tracing because this phase is local-preview-only.
- A duplicate child `generateStaticParams` definition was removed; the parent locale layout already owns locale generation. The final build generated all 288 pages successfully.

## Remaining scope boundary

This is a concept preview, not a production integration. The source assets are intentionally not copied into `public` or a CDN and the current homepage hero remains untouched. Production integration requires a separate approval and asset-delivery decision.
