import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AdminShell } from "../components/admin-shell";

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
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
