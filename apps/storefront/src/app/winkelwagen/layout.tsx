import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Winkelwagen",
  robots: { index: false, follow: false },
};

export default function WinkelwagenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
