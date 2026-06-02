import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminHeader } from "../components/layout/AdminHeader";
import { AdminFooter } from "../components/layout/AdminFooter";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Admin | De Notenman",
  description: "Beheeromgeving voor De Notenman.",
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