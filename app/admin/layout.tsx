import { Dosis, Montserrat } from "next/font/google";
import "@/app/globals.css";

const dosis = Dosis({
  subsets: ["latin"],
  variable: "--font-dosis",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "De Notenman — Admin",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.png" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${dosis.variable} ${montserrat.variable}`}>
      <body className="bg-background font-body text-text">{children}</body>
    </html>
  );
}
