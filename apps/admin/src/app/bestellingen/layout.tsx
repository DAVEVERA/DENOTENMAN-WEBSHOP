import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bestellingen · Beheer",
};

export default function BestellingenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
