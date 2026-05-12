import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Beheer · DeNotenman",
  description: "Beheerpaneel voor De Notenman.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={inter.variable}>
      <body className="admin-layout">
        <aside className="admin-sidebar" aria-label="Navigatie">
          {/* Sidebar-navigatie wordt in sprint 2 toegevoegd */}
          <div className="p-4 border-b border-neutral-200">
            <span className="text-sm font-semibold text-neutral-700">De Notenman</span>
          </div>
        </aside>
        <main className="admin-main" id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
