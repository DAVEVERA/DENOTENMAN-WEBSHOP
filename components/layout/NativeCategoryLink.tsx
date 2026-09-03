"use client";

import type { AnchorHTMLAttributes, MouseEvent, Ref } from "react";

function isNavigationModified(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Renders a plain anchor, but forces a real browser navigation on click
 * (capture phase, so it runs before anything else can intercept the
 * click) instead of relying on the App Router's client-side navigation.
 * That client-side path has been observed to apply a different,
 * already-prefetched category story page's content to this URL — see
 * the category-routing incident notes. window.location.assign bypasses
 * the router entirely, regardless of what's intercepting the click.
 */
export function NativeCategoryLink({
  anchorRef,
  href,
  target,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  anchorRef?: Ref<HTMLAnchorElement>;
}) {
  return (
    <a
      ref={anchorRef}
      href={href}
      target={target}
      {...props}
      onClickCapture={(event) => {
        if (!isNavigationModified(event) && target !== "_blank" && href) {
          event.preventDefault();
          window.location.assign(href);
        }
      }}
    />
  );
}
