import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "DeNotenman — Noten, Zuidvruchten & Meer",
    template: "%s | DeNotenman",
  },
  description:
    "Premium noten, zuidvruchten, pitten, zaden en honing. Vers verpakt, eerlijke herkomst, zonder onnodige toevoegingen.",
  metadataBase: new URL("https://denotenman.nl"),
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "DeNotenman",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
