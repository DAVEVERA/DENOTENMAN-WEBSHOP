import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children?: ReactNode;
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label className={cn("block text-sm font-medium text-neutral-800", className)} {...props}>
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          {" "}
          *
        </span>
      )}
    </label>
  );
}
