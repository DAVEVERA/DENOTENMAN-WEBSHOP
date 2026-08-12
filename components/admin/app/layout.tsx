import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminHeader } from "../components/layout/AdminHeader";
import { AdminFooter } from "../components/layout/AdminFooter";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Admin | De Notenman",
  description: "Beheeromgeving voor De Notenman.",
  icons: {
    icon: "/Notenman_onlylogo.png",
    shortcut: "/Notenman_onlylogo.png",
    apple: "/Notenman_onlylogo.png",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>
        <div className="admin-shell">
          <AdminHeader />
          {children}
          <AdminFooter />
        </div>
      </body>
    </html>
  );
}
