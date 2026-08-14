"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProductDetailModal({
  children,
  locale,
  productName,
  backLabel,
  closeLabel,
  intercepted = false,
}: {
  children: ReactNode;
  locale: Locale;
  productName: string;
  backLabel: string;
  closeLabel: string;
  intercepted?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (intercepted) {
      router.back();
      return;
    }

    router.push(home(locale));
  }, [intercepted, locale, router]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => backButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-5 lg:p-8">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
        onClick={close}
        aria-label={closeLabel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={productName}
        className="relative flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[14px] border border-[#D7D7D7] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:max-h-[92dvh] sm:max-w-6xl sm:rounded-[14px]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#D8E8EA] bg-[#E8F5F7] px-3 py-2.5 sm:px-5 sm:py-3">
          <button
            ref={backButtonRef}
            type="button"
            onClick={close}
            className="inline-flex min-h-11 items-center gap-2 rounded-button px-3 font-heading font-bold text-black transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            {backLabel}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#FF4646] transition-colors hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4646]/50"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>
  );
}
