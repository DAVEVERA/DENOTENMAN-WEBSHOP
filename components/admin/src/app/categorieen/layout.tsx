import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Categorieën · Beheer",
};

export default function CategorieenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
