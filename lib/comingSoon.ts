export const PREVIEW_COOKIE = "denotenman_preview";

export function isComingSoonEnabled(): boolean {
  return process.env.COMING_SOON === "true";
}

export function previewToken(): string | undefined {
  return process.env.PREVIEW_TOKEN;
}

export function comingSoonHtml(): string {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#171a16">
  <title>De Notenman — vers gebrande noten thuisbezorgd</title>
  <link rel="icon" href="/brand/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dosis:wght@500;600;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --chalkboard: #1e201d;
      --chalk: #fffdf5;
      --chalk-muted: rgba(255, 253, 245, .76);
      --wood-dark: #2a1b13;
      --wood: #4b3020;
      --wood-light: #6f4930;
      --mustard: #e0b200;
      --mustard-hover: #f0c327;
      --mustard-dark: #a97800;
      --ink: #171714;
      --paper: #f5ecd9;
      --body-font: "Montserrat", Arial, sans-serif;
      --display-font: "Dosis", "Trebuchet MS", sans-serif;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      min-width: 320px;
      color: var(--chalk);
      background: #121510;
      font-family: var(--body-font);
    }

    a { color: inherit; }

    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      min-height: 100dvh;
      padding: 24px 16px 30px;
      background: #c9c8bf;
      display: flex;
      align-items: center;
    }

    .video-stage {
      position: absolute;
      inset: 0;
      z-index: -4;
      overflow: hidden;
      background: #cfcec5;
    }

    .hero__video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 42% center;
      opacity: 0;
      transition: opacity 900ms ease-in-out;
      will-change: opacity;
    }

    .hero__video.is-active { opacity: 1; }

    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -3;
      pointer-events: none;
      background:
        linear-gradient(0deg, rgba(12, 14, 11, .78) 0%, rgba(12, 14, 11, .22) 66%, rgba(12, 14, 11, .09) 100%),
        linear-gradient(90deg, rgba(12, 14, 11, .68), rgba(12, 14, 11, .16) 78%, rgba(12, 14, 11, .04));
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -2;
      opacity: .1;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
    }

    .hero__content {
      width: min(100%, 1040px);
      margin: 0;
      animation: arrive .7s cubic-bezier(.2, .8, .2, 1) both;
    }

    .chalkboard {
      position: relative;
      max-width: 690px;
      padding: 26px 22px 28px;
      border: 9px solid var(--wood);
      background:
        radial-gradient(circle at 23% 20%, rgba(255,255,255,.035), transparent 35%),
        linear-gradient(114deg, transparent 48%, rgba(255,255,255,.02) 50%, transparent 52%),
        var(--chalkboard);
      box-shadow:
        inset 0 0 48px rgba(0,0,0,.88),
        inset 0 0 4px 2px rgba(255,255,255,.04),
        11px 14px 26px rgba(0,0,0,.4);
      transform: rotate(-.45deg);
    }

    .chalkboard::before,
    .chalkboard::after {
      content: "";
      position: absolute;
      left: -9px;
      right: -9px;
      height: 4px;
      opacity: .28;
      background: linear-gradient(90deg, transparent, var(--wood-light) 18%, var(--wood-dark) 46%, var(--wood-light) 77%, transparent);
    }

    .chalkboard::before { top: -6px; }
    .chalkboard::after { bottom: -6px; }

    .eyebrow,
    h1,
    .button,
    .favorites__title,
    .product-card__title,
    .product-card__meta {
      font-family: var(--display-font);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 14px;
      padding: 7px 11px 6px;
      border: 1px solid rgba(255,255,255,.25);
      color: rgba(255,255,255,.72);
      font-size: .76rem;
      font-weight: 600;
      line-height: 1;
      letter-spacing: .13em;
      text-transform: uppercase;
    }

    .eyebrow::before {
      content: "";
      width: 16px;
      height: 2px;
      background: currentColor;
    }

    h1 {
      max-width: 590px;
      margin: 0 0 14px;
      color: var(--chalk);
      font-size: clamp(2.15rem, 9.25vw, 3.1rem);
      font-weight: 600;
      line-height: 1;
      letter-spacing: -.025em;
      text-wrap: balance;
    }

    .intro {
      max-width: 560px;
      margin: 0 0 21px;
      color: var(--chalk-muted);
      font-size: .96rem;
      font-weight: 600;
      line-height: 1.4;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 13px 22px 10px;
      border: 0;
      border-bottom: 4px solid var(--mustard-dark);
      color: var(--ink);
      background: var(--mustard);
      font-size: .95rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: .075em;
      text-align: center;
      text-decoration: none;
      text-transform: uppercase;
      box-shadow: 4px 5px 0 rgba(0,0,0,.16);
      transition: transform .18s ease, border-width .18s ease, background-color .18s ease;
    }

    .button:hover { transform: translateY(2px); border-bottom-width: 2px; background: var(--mustard-hover); }
    .button:active { transform: translateY(4px); border-bottom-width: 0; }
    .button:focus-visible,
    .product-card:focus-within { outline: 3px dashed var(--chalk); outline-offset: 4px; }

    .favorites {
      width: 100%;
      margin-top: 20px;
    }

    .favorites__header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 11px;
      padding-inline: 3px;
    }

    .favorites__title {
      margin: 0;
      color: #fffdf5;
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: .025em;
    }

    .favorites__hint {
      margin: 0;
      color: rgba(255,255,255,.72);
      font-size: .67rem;
      font-weight: 600;
      letter-spacing: .1em;
      text-transform: uppercase;
    }

    .product-grid {
      display: grid;
      grid-auto-columns: min(78vw, 290px);
      grid-auto-flow: column;
      gap: 18px;
      overflow-x: auto;
      padding: 12px 10px 18px;
      scroll-padding-left: 10px;
      scroll-snap-type: x mandatory;
      scrollbar-color: var(--mustard) rgba(255,255,255,.18);
      scrollbar-width: thin;
    }

    .product-card {
      position: relative;
      display: grid;
      grid-template-rows: 132px auto;
      min-width: 0;
      overflow: hidden;
      border: 8px solid var(--wood);
      color: var(--chalk);
      background: var(--chalkboard);
      box-shadow:
        inset 0 0 28px rgba(0,0,0,.48),
        9px 11px 20px rgba(0,0,0,.34);
      scroll-snap-align: start;
      transform-origin: 50% 16%;
    }

    .product-card::before {
      content: "";
      position: absolute;
      top: 5px;
      left: 50%;
      z-index: 2;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #b88b35;
      box-shadow: inset 1px 1px 2px rgba(255,255,255,.45), 0 2px 3px rgba(0,0,0,.4);
      transform: translateX(-50%);
    }

    .product-card:nth-child(1) { transform: rotate(-1.25deg) translateY(7px); }
    .product-card:nth-child(2) { transform: rotate(1deg); }
    .product-card:nth-child(3) { transform: rotate(-.8deg) translateY(9px); }

    .product-card__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-bottom: 6px solid var(--wood);
      background: #f6f5f1;
    }

    .product-card__body {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "meta meta"
        "title title"
        "copy copy"
        "cta cta";
      gap: 5px 10px;
      padding: 13px 14px 14px;
    }

    .product-card__meta {
      grid-area: meta;
      margin: 0;
      color: var(--mustard);
      font-size: .67rem;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .product-card__title {
      grid-area: title;
      margin: 0;
      color: var(--chalk);
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
    }

    .product-card__copy {
      grid-area: copy;
      margin: 0 0 7px;
      color: rgba(255,253,245,.68);
      font-size: .74rem;
      line-height: 1.45;
    }

    .button--product {
      grid-area: cta;
      width: 100%;
      min-height: 44px;
      padding: 11px 14px 8px;
      font-size: .8rem;
      box-shadow: 3px 4px 0 rgba(61,43,31,.14);
    }

    @keyframes arrive {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (min-width: 560px) {
      .hero { padding: 34px 28px 38px; }
      .chalkboard { padding: 32px 34px 34px; }
      .intro { font-size: .96rem; }
      .product-grid { grid-auto-columns: 280px; }
    }

    @media (min-width: 760px) {
      .hero { padding: 32px clamp(34px, 5vw, 76px) 34px; }
      .hero::before {
        background:
          linear-gradient(90deg, rgba(12,14,11,.88) 0%, rgba(12,14,11,.54) 42%, rgba(12,14,11,.08) 72%),
          linear-gradient(0deg, rgba(12,14,11,.46), transparent 35%);
      }
      .hero__video {
        inset: 0 auto 0 24%;
        width: 82%;
        object-position: center;
      }
      .hero__content { margin-left: clamp(0px, 2vw, 28px); }
      .chalkboard { border-width: 12px; padding: 26px 32px 28px; }
      h1 { font-size: clamp(2.7rem, 3.6vw, 3.35rem); }
      .intro { font-size: 1rem; }
      .favorites { margin-top: 18px; }
      .favorites__header { max-width: 915px; }
      .favorites__hint { display: none; }
      .product-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-auto-flow: initial;
        grid-auto-columns: initial;
        max-width: 915px;
        gap: 22px;
        overflow: visible;
        padding: 12px 10px 18px;
      }
      .product-card { grid-template-columns: 112px 1fr; grid-template-rows: auto; min-height: 188px; }
      .product-card__image {
        min-height: 188px;
        border-right: 6px solid var(--wood);
        border-bottom: 0;
      }
      .product-card__body { padding: 15px 13px 14px; }
      .button--product { padding-inline: 8px; font-size: .73rem; }
    }

    @media (min-width: 1180px) {
      .hero__video { left: 30%; width: 74%; }
      .product-grid { max-width: 1000px; }
      .favorites__header { max-width: 1000px; }
      .product-card { grid-template-columns: 126px 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .hero__content { animation: none; }
      .hero__video, .button { transition: none; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="video-stage" aria-hidden="true">
        <video class="hero__video is-active" autoplay muted loop playsinline preload="auto">
          <source src="/hero/stroom_voedselgeheel_rechts_ui.mp4" type="video/mp4">
        </video>
      </div>

      <div class="hero__content">
        <div class="chalkboard">
          <div class="eyebrow">De Notenman</div>
          <h1 id="hero-title">Heerlijke vers gebrande noten &amp; gedroogde zuidvruchten!</h1>
          <p class="intro">Nu ook thuisbezorgd</p>
          <a class="button" href="#bestellen">Bestel nu!</a>
        </div>

        <section class="favorites" id="favorieten" aria-labelledby="favorites-title">
          <div class="favorites__header">
            <h2 class="favorites__title" id="favorites-title">Onze favorieten</h2>
            <p class="favorites__hint">Swipe om te bekijken</p>
          </div>

          <div class="product-grid">
            <article class="product-card">
              <img class="product-card__image" src="https://storage.googleapis.com/notenbucket/products/pistaches-gepeld-gebrand/4d5460ea-9512-4023-b44f-afbe8cd8a559.webp" alt="Gepelde pistachenoten" width="900" height="900">
              <div class="product-card__body">
                <p class="product-card__meta">Vers gebrand</p>
                <h3 class="product-card__title">Pistache</h3>
                <p class="product-card__copy">Knapperig, vol van smaak en vers uit onze kraam.</p>
                <a class="button button--product" href="#bestel-pistache">Bestel pistache</a>
              </div>
            </article>

            <article class="product-card">
              <img class="product-card__image" src="https://storage.googleapis.com/notenbucket/products/cashewnoten-gezouten/8ed685fe-e5df-4b43-b4d4-aa0e6eb6dea6.webp" alt="Cashewnoten" width="900" height="900">
              <div class="product-card__body">
                <p class="product-card__meta">Vers gebrand</p>
                <h3 class="product-card__title">Cashew</h3>
                <p class="product-card__copy">Romig, zacht en precies goed gebrand.</p>
                <a class="button button--product" href="#bestel-cashew">Bestel cashew</a>
              </div>
            </article>

            <article class="product-card">
              <img class="product-card__image" src="https://storage.googleapis.com/notenbucket/products/pecannoten-gezouten/84a4f2b8-b028-404d-afd4-717774743972.webp" alt="Pecannoten" width="900" height="900">
              <div class="product-card__body">
                <p class="product-card__meta">Van nature zoet</p>
                <h3 class="product-card__title">Pecannoten</h3>
                <p class="product-card__copy">Vol, zacht en heerlijk als snack of door je ontbijt.</p>
                <a class="button button--product" href="#bestel-pecannoten">Bestel pecannoten</a>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </main>
</body>
</html>`;
}
