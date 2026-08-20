import type { Metadata } from "next";
import { CloudCostsDashboard } from "@/components/admin-panel/CloudCostsDashboard";

export const metadata: Metadata = {
  title: "Kostenoverzicht | Admin",
};

export default function CloudCostsPage() {
  return <CloudCostsDashboard />;
}
