import type { InputHTMLAttributes, ReactNode } from "react";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
};

export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}