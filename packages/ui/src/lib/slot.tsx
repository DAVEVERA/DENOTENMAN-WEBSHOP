import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type HTMLAttributes,
} from "react";

interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

type AnyProps = Record<string, unknown>;

/**
 * Merges its own props onto its single child element.
 * Mirrors the Radix Slot pattern without the Radix dependency.
 */
export function Slot({ children, ...slotProps }: SlotProps) {
  if (!isValidElement(children)) {
    return null;
  }

  const child = children as ReactElement<AnyProps>;
  const childProps: AnyProps = child.props;
  const slotPropsAsAny: AnyProps = slotProps;

  const slotClassName = slotPropsAsAny.className as string | undefined;
  const childClassName = childProps.className as string | undefined;

  const mergedClassName = [slotClassName, childClassName].filter(Boolean).join(" ") || undefined;

  const mergedProps: AnyProps = {
    ...slotPropsAsAny,
    ...childProps,
    ...(mergedClassName !== undefined ? { className: mergedClassName } : {}),
  };

  return cloneElement(child, mergedProps);
}
