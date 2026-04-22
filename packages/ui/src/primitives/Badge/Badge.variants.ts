import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 text-neutral-700",
        success: "bg-success-light text-success border border-success-border",
        warning: "bg-warning-light text-warning border border-warning-border",
        danger: "bg-danger-light text-danger border border-danger-border",
        muted: "bg-neutral-100 text-neutral-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
