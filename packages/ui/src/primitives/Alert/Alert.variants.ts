import { cva } from "class-variance-authority";

export const alertVariants = cva("relative w-full rounded-lg border p-4", {
  variants: {
    variant: {
      info: "border-info-border bg-info-light text-info",
      success: "border-success-border bg-success-light text-success",
      warning: "border-warning-border bg-warning-light text-warning",
      danger: "border-danger-border bg-danger-light text-danger",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});
