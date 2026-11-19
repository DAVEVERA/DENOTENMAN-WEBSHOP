"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Banner = { id: string; title: string; slot: "TOP" | "BOTTOM"; imageUrl: string; linkUrl: string | null };

export function StorefrontCampaignBanners({ slot }: { slot: Banner["slot"] }) {
  const pathname = usePathname();
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/storefront/banners?path=${encodeURIComponent(pathname)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ banners: Banner[] }> : Promise.reject(new Error("Banners unavailable")))
      .then((result) => setBanners(result.banners))
      .catch(() => { if (!controller.signal.aborted) setBanners([]); });
    return () => controller.abort();
  }, [pathname]);
  const visible = banners.filter((banner) => banner.slot === slot);
  if (visible.length === 0) return null;
  return <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6" aria-label="Acties van De Notenman">{visible.map((banner) =>
    banner.linkUrl ? <a key={banner.id} href={banner.linkUrl} className="block overflow-hidden rounded-card"><img src={banner.imageUrl} alt={banner.title} className="h-auto w-full" /></a>
      : <div key={banner.id} className="overflow-hidden rounded-card"><img src={banner.imageUrl} alt={banner.title} className="h-auto w-full" /></div>,
  )}</div>;
}
