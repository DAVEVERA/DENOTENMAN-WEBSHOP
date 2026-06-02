import type { ReactNode } from "react";

type DrawerProps = {
  title: string;
  children: ReactNode;
};

export function Drawer({ title, children }: DrawerProps) {
  return (
    <aside className="drawer-panel">
      <h2>{title}</h2>
      <div>{children}</div>
    </aside>
  );
}