import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium rounded-md",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-green text-white",
          "hover:bg-brand-green-600",
          "focus-visible:ring-brand-green",
        ],
        secondary: [
          "bg-neutral-100 text-neutral-900 border border-neutral-200",
          "hover:bg-neutral-200",
          "focus-visible:ring-neutral-400",
        ],
        ghost: [
          "bg-transparent text-neutral-800",
          "hover:bg-neutral-100",
          "focus-visible:ring-neutral-400",
        ],
        destructive: ["bg-danger text-white", "hover:bg-red-700", "focus-visible:ring-danger"],
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
