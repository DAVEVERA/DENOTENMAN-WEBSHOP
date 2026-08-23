"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pause,
  Play,
  ShoppingCart,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Locale } from "@/lib/i18n";
import type { HomeSliderProductDto } from "@/lib/home-product-slider";
import { wrapHomeSliderIndex } from "@/lib/home-product-slider";
import { formatPrice } from "@/lib/format";
import { cart as cartPath } from "@/lib/routes";
import {
  addCartItem,
  toggleFavorite,
  useStorefrontState,
} from "@/lib/storefront-state";
import styles from "@/components/home/HomeProductSlider.module.css";

type HomeProductSliderCopy = {
  carouselLabel: string;
  pauseMotion: string;
  resumeMotion: string;
  previousProduct: string;
  nextProduct: string;
  openProduct: string;
  position: string;
  fromPrice: string;
  close: string;
  quickOrder: string;
  moreInfo: string;
  outOfStock: string;
  added: string;
  goToCart: string;
  continueShopping: string;
  addToFavorites: string;
  removeFromFavorites: string;
};

type OpenReason = "hover" | "focus" | "click";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  axis: "x" | "y" | null;
  moved: boolean;
};

export function HomeProductSlider({
  locale,
  products,
  copy,
}: {
  locale: Locale;
  products: HomeSliderProductDto[];
  copy: HomeProductSliderCopy;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const setWidthRef = useRef(0);
  const slideRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const pointerActivationRef = useRef(false);
  const suppressClickRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const canHoverRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [openReason, setOpenReason] = useState<OpenReason | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const storefront = useStorefrontState();
  const repeatedSets = products.length > 1 ? ([0, 1, 2] as const) : ([1] as const);

  const activeProduct =
    products.find((product) => product.key === activeKey) ?? null;
  const isModal = Boolean(activeProduct && openReason === "click");
  const motionPaused =
    isPointerInside ||
    isInteracting ||
    isManuallyPaused ||
    isReducedMotion ||
    Boolean(activeProduct);

  const normalizeScrollPosition = useCallback(() => {
    const viewport = viewportRef.current;
    const setWidth = setWidthRef.current;
    if (!viewport || setWidth <= 0) return;

    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;

    if (viewportCenter >= setWidth * 2) {
      viewport.scrollLeft -= setWidth;
    } else if (viewportCenter < setWidth) {
      viewport.scrollLeft += setWidth;
    }
  }, []);

  const closestIndexToScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || products.length === 0) return 0;

    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });

    return closestIndex;
  }, [products.length]);

  const syncActiveIndexToScroll = useCallback(() => {
    const closestIndex = closestIndexToScroll();
    setActiveIndex((current) => (current === closestIndex ? current : closestIndex));
  }, [closestIndexToScroll]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      normalizeScrollPosition();
      syncActiveIndexToScroll();
    });
  }, [normalizeScrollPosition, syncActiveIndexToScroll]);

  const pauseForInteraction = useCallback(() => {
    setIsInteracting(true);
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setIsInteracting(false);
      resumeTimerRef.current = null;
    }, 1200);
  }, []);

  useEffect(
    () => () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateHover = () => {
      canHoverRef.current = hoverQuery.matches;
    };
    const updateMotion = () => setIsReducedMotion(motionQuery.matches);

    updateHover();
    updateMotion();
    hoverQuery.addEventListener("change", updateHover);
    motionQuery.addEventListener("change", updateMotion);
    return () => {
      hoverQuery.removeEventListener("change", updateHover);
      motionQuery.removeEventListener("change", updateMotion);
    };
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const firstSet = firstSetRef.current;
    if (!viewport || !firstSet) return;

    const measure = () => {
      const setWidth = firstSet.getBoundingClientRect().width;
      if (setWidth <= 0) return;
      const previousWidth = setWidthRef.current;
      setWidthRef.current = setWidth;
      if (previousWidth === 0) {
        const firstSlide = slideRefs.current[0];
        viewport.scrollLeft =
          products.length > 1 && firstSlide
            ? firstSlide.offsetLeft - (viewport.clientWidth - firstSlide.offsetWidth) / 2
            : 0;
        syncActiveIndexToScroll();
      } else if (Math.abs(previousWidth - setWidth) > 1) {
        viewport.scrollLeft += setWidth - previousWidth;
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(firstSet);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [products.length, syncActiveIndexToScroll]);

  useEffect(() => {
    if (motionPaused || products.length < 2) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame = 0;
    let previousTime = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(time - previousTime, 48);
      previousTime = time;
      viewport.scrollLeft += elapsed * 0.035;
      normalizeScrollPosition();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [motionPaused, normalizeScrollPosition, products.length]);

  const focusProduct = useCallback(
    (index: number, moveFocus = false, setOffset = 0) => {
      const viewport = viewportRef.current;
      const target = slideRefs.current[index];
      if (!viewport || !target) return;
      const targetLeft =
        target.offsetLeft +
        setOffset * setWidthRef.current -
        (viewport.clientWidth - target.offsetWidth) / 2;
      viewport.scrollTo({
        left: targetLeft,
        behavior: isReducedMotion ? "auto" : "smooth",
      });
      if (moveFocus) {
        window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    },
    [isReducedMotion],
  );

  const openProduct = useCallback(
    (index: number, reason: OpenReason) => {
      const product = products[index];
      if (!product) return;
      setOpenReason(reason);
      setActiveIndex(index);
      setActiveKey(product.key);
      setAddedKey(null);
      if (reason !== "hover") focusProduct(index);
    },
    [focusProduct, products],
  );

  const closeProduct = useCallback(
    (restoreFocus = true) => {
      const reason = openReason;
      setOpenReason(null);
      setActiveKey(null);
      setAddedKey(null);
      if (restoreFocus && reason !== "hover") {
        window.requestAnimationFrame(() => slideRefs.current[activeIndex]?.focus());
      }
    },
    [activeIndex, openReason],
  );

  useEffect(() => {
    if (!isModal) return;
    const frame = window.requestAnimationFrame(() => {
      cardRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProduct?.key, isModal]);

  const step = useCallback(
    (direction: -1 | 1, moveFocus = false) => {
      if (products.length < 2) return;
      const currentIndex = closestIndexToScroll();
      const nextIndex = wrapHomeSliderIndex(currentIndex + direction, products.length);
      setActiveIndex(nextIndex);
      if (activeProduct) {
        setActiveKey(products[nextIndex]?.key ?? null);
        setAddedKey(null);
      }
      setAnnouncement(
        copy.position
          .replace("{current}", String(nextIndex + 1))
          .replace("{total}", String(products.length)),
      );
      pauseForInteraction();
      const setOffset =
        currentIndex === 0 && direction === -1
          ? -1
          : currentIndex === products.length - 1 && direction === 1
            ? 1
            : 0;
      focusProduct(nextIndex, moveFocus, setOffset);
    },
    [activeProduct, closestIndexToScroll, copy.position, focusProduct, pauseForInteraction, products],
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      axis: null,
      moved: false,
    };
    setIsInteracting(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 7) {
      drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (drag.axis === "x") viewport.setPointerCapture(event.pointerId);
    }
    if (drag.axis !== "x") return;

    event.preventDefault();
    drag.moved = Math.abs(deltaX) > 10;
    viewport.scrollLeft = drag.startScrollLeft - deltaX;
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickRef.current = true;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    pointerActivationRef.current = false;
    normalizeScrollPosition();
    pauseForInteraction();
  }

  function handleProductClick(index: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openProduct(index, "click");
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Tab" && isModal && cardRef.current) {
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1, true);
    } else if (event.key === "Escape" && activeProduct) {
      event.preventDefault();
      closeProduct();
    }
  }

  function addActiveProductToCart() {
    if (!activeProduct?.defaultVariant || activeProduct.defaultVariant.stock <= 0) return;
    const variant = activeProduct.defaultVariant;
    addCartItem(
      {
        variantId: variant.id,
        productId: activeProduct.id,
        slug: activeProduct.slug,
        name: activeProduct.name,
        variantLabel: variant.label ?? `${variant.weightGrams} g`,
        priceCents: variant.priceCents,
        imageUrl: activeProduct.imageSrc,
        locale,
      },
      1,
    );
    setAddedKey(activeProduct.key);
  }

  const favoriteActiveProduct = activeProduct
    ? storefront.favorites.some((favorite) => favorite.productId === activeProduct.id)
    : false;

  return (
    <div
      className={styles.hero}
      role="region"
      aria-roledescription="carousel"
      aria-label={copy.carouselLabel}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && canHoverRef.current) {
          setIsPointerInside(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && canHoverRef.current) {
          setIsPointerInside(false);
          if (openReason === "hover") closeProduct(false);
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {!activeProduct && !isReducedMotion && products.length > 1 ? (
        <div
          className={styles.mobileControls}
          role="group"
          aria-label={copy.carouselLabel}
        >
          <button
            type="button"
            className={`${styles.mobileControl} ${styles.previousControl}`}
            aria-label={copy.previousProduct}
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.mobileControl} ${styles.motionButton}`}
            aria-label={isManuallyPaused ? copy.resumeMotion : copy.pauseMotion}
            aria-pressed={isManuallyPaused}
            onClick={() => setIsManuallyPaused((paused) => !paused)}
          >
            {isManuallyPaused ? (
              <Play aria-hidden="true" fill="none" />
            ) : (
              <Pause aria-hidden="true" fill="none" />
            )}
          </button>
          <button
            type="button"
            className={`${styles.mobileControl} ${styles.nextControl}`}
            aria-label={copy.nextProduct}
            onClick={() => step(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-home-slider-viewport
        aria-hidden={isModal ? true : undefined}
        inert={isModal ? true : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onScroll={handleScroll}
      >
        <div className={styles.track}>
          {repeatedSets.map((setIndex) => {
            const isInteractiveSet = setIndex === 1;
            return (
              <div
                key={setIndex}
                ref={setIndex === repeatedSets[0] ? firstSetRef : undefined}
                className={styles.productSet}
                role={isInteractiveSet ? "list" : undefined}
                aria-hidden={isInteractiveSet ? undefined : true}
              >
                {products.map((product, index) => {
                  const image = (
                    <span className={styles.imageShell}>
                      <Image
                        src={product.imageSrc}
                        alt={isInteractiveSet ? product.name : ""}
                        width={product.imageWidth}
                        height={product.imageHeight}
                        sizes="(max-width: 639px) 46vw, (max-width: 1023px) 24vw, 13rem"
                        quality={70}
                        loading={
                          index <= 2 || index >= products.length - 3 ? "eager" : "lazy"
                        }
                        fetchPriority={setIndex === 1 && index === 0 ? "high" : "auto"}
                        draggable={false}
                        className={styles.productImage}
                      />
                    </span>
                  );

                  return (
                    <div
                      key={`${setIndex}-${product.key}`}
                      className={styles.slide}
                      role={isInteractiveSet ? "listitem" : undefined}
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse" && canHoverRef.current) {
                          openProduct(index, "hover");
                        }
                      }}
                      onClick={
                        isInteractiveSet ? undefined : () => handleProductClick(index)
                      }
                    >
                      {isInteractiveSet ? (
                        <button
                          ref={(node) => {
                            slideRefs.current[index] = node;
                          }}
                          type="button"
                          className={styles.productButton}
                          tabIndex={index === activeIndex ? 0 : -1}
                          aria-label={copy.openProduct.replace("{product}", product.name)}
                          onPointerDown={() => {
                            pointerActivationRef.current = true;
                          }}
                          onPointerCancel={() => {
                            pointerActivationRef.current = false;
                          }}
                          onFocus={(event) => {
                            if (
                              !pointerActivationRef.current &&
                              event.currentTarget.matches(":focus-visible")
                            ) {
                              openProduct(index, "focus");
                            }
                          }}
                          onClick={() => {
                            pointerActivationRef.current = false;
                            handleProductClick(index);
                          }}
                        >
                          {image}
                          <span className={styles.slideName}>{product.name}</span>
                        </button>
                      ) : (
                        <div className={styles.productButton}>
                          {image}
                          <span className={styles.slideName}>{product.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {activeProduct ? (
        <>
          <div
            className={`${styles.backdrop} ${isModal ? styles.backdropInteractive : ""}`}
            aria-hidden="true"
            onPointerDown={isModal ? () => closeProduct() : undefined}
          />
          <article
            ref={cardRef}
            className={styles.productCard}
            role={isModal ? "dialog" : "region"}
            aria-modal={isModal ? true : undefined}
            aria-labelledby={`slider-product-${activeProduct.id}`}
          >
            <button
              type="button"
              className={styles.closeButton}
              aria-label={copy.close}
              onClick={() => closeProduct()}
            >
              <X aria-hidden="true" />
            </button>

            <div className={styles.cardImageShell}>
              <Image
                src={activeProduct.imageSrc}
                alt=""
                width={activeProduct.imageWidth}
                height={activeProduct.imageHeight}
                sizes="7rem"
                quality={70}
                className={styles.cardImage}
              />
            </div>
            {activeProduct.categoryName ? (
              <p className={styles.category}>{activeProduct.categoryName}</p>
            ) : null}
            <h2 id={`slider-product-${activeProduct.id}`} className={styles.productName}>
              {activeProduct.name}
            </h2>
            {activeProduct.shortDescription ? (
              <p className={styles.description}>{activeProduct.shortDescription}</p>
            ) : null}

            <div className={styles.priceRow}>
              <p className={styles.price}>
                {activeProduct.hasVariablePrice ? (
                  <span className={styles.fromPrice}>{copy.fromPrice} </span>
                ) : null}
                {formatPrice(activeProduct.priceCents, locale)}
                {activeProduct.salePriceCents !== null ? (
                  <del>{formatPrice(activeProduct.regularPriceCents, locale)}</del>
                ) : null}
              </p>
              <button
                type="button"
                className={styles.favoriteButton}
                aria-label={
                  favoriteActiveProduct ? copy.removeFromFavorites : copy.addToFavorites
                }
                aria-pressed={favoriteActiveProduct}
                onClick={() => {
                  toggleFavorite({
                    productId: activeProduct.id,
                    slug: activeProduct.slug,
                    name: activeProduct.name,
                    basePriceCents: activeProduct.priceCents,
                    imageUrl: activeProduct.imageSrc,
                    locale,
                  });
                }}
              >
                <Heart aria-hidden="true" fill={favoriteActiveProduct ? "currentColor" : "none"} />
              </button>
            </div>

            {addedKey === activeProduct.key ? (
              <div className={styles.addedPanel}>
                <p role="status" aria-live="polite">
                  <Check aria-hidden="true" />
                  {copy.added}
                </p>
                <div className={styles.addedActions}>
                  <Link href={cartPath(locale)} className={styles.primaryButton}>
                    <ShoppingCart aria-hidden="true" />
                    {copy.goToCart}
                  </Link>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => closeProduct()}
                  >
                    {copy.continueShopping}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    !activeProduct.defaultVariant || activeProduct.defaultVariant.stock <= 0
                  }
                  onClick={addActiveProductToCart}
                >
                  <ShoppingCart aria-hidden="true" />
                  {activeProduct.defaultVariant && activeProduct.defaultVariant.stock > 0
                    ? copy.quickOrder
                    : copy.outOfStock}
                </button>
                <Link href={activeProduct.href} className={styles.secondaryButton}>
                  {copy.moreInfo}
                </Link>
              </div>
            )}
          </article>
        </>
      ) : null}
    </div>
  );
}
