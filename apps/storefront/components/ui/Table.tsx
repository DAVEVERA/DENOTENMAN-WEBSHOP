import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}