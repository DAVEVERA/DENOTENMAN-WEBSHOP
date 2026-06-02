import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_BASE_URL, SITE_NAME } from "../lib/seo";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Van markt tot webshop: De specialist in noten, pitten en gedroogd fruit.",
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "Van markt tot webshop: De specialist in noten, pitten en gedroogd fruit.",
    url: SITE_BASE_URL,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Van markt tot webshop: De specialist in noten, pitten en gedroogd fruit.",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  icons: {
    icon: "/Favicon.png",
    shortcut: "/Favicon.png",
    apple: "/Notenman_onlynoot_icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
