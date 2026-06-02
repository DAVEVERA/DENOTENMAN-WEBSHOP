import type { InputHTMLAttributes, ReactNode } from "react";

type RadioProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
};

export function Radio({ label, ...props }: RadioProps) {
  return (
    <label className="checkbox-field">
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}