import type { TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";
import { Label } from "../Label/Label";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  required,
  containerClassName,
  id: idProp,
  className,
  disabled,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", containerClassName)}>
      {label && (
        <Label htmlFor={id} {...(required !== undefined ? { required } : {})}>
          {label}
        </Label>
      )}
      <textarea
        id={id}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required}
        rows={4}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-base",
          "bg-white text-neutral-900 placeholder:text-neutral-400",
          "resize-y transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
          error
            ? "border-danger focus-visible:ring-danger"
            : "border-neutral-300 hover:border-neutral-400",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
