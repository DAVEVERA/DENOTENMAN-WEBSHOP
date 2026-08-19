import type { AnchorHTMLAttributes, Ref } from "react";

export function NativeCategoryLink({
  anchorRef,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  anchorRef?: Ref<HTMLAnchorElement>;
}) {
  return <a ref={anchorRef} {...props} />;
}
