import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Producten · Beheer",
};

export default function ProductenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
