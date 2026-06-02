import type { SelectHTMLAttributes, ReactNode } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  children: ReactNode;
};

export function Select({ label, id, children, ...props }: SelectProps) {
  return (
    <label className="form-field">
      {label && <span>{label}</span>}
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}