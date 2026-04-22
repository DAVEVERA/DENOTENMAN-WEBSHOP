import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "../../lib/slot";
import { cn } from "../../lib/cn";
import { buttonVariants } from "./Button.variants";
import { Spinner } from "../Spinner/Spinner";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  asChild = false,
  loading = false,
  variant,
  size,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled ?? loading;
  const sharedClassName = cn(buttonVariants({ variant, size }), className);

  const content: ReactNode = loading ? (
    <>
      <Spinner size="sm" label="Bezig…" />
      {children}
    </>
  ) : (
    children
  );

  if (asChild) {
    return (
      <Slot
        className={sharedClassName}
        aria-disabled={isDisabled ? true : undefined}
        aria-busy={loading ? true : undefined}
      >
        {children as ReactElement}
      </Slot>
    );
  }

  return (
    <button
      className={sharedClassName}
      disabled={isDisabled}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={loading ? true : undefined}
      {...props}
    >
      {content}
    </button>
  );
}
