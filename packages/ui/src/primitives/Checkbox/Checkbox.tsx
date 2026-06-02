import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export function Checkbox({
  label,
  hint,
  error,
  containerClassName,
  id: idProp,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", containerClassName)}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded border border-neutral-300",
            "accent-brand-green",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger" : undefined,
            className,
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm text-neutral-800 leading-5",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
          >
            {label}
          </label>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="pl-6 text-sm text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="pl-6 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
