import type { NextConfig } from "next";

const cdnBaseUrl = process.env.CDN_BASE_URL;
const cdnHostname = cdnBaseUrl ? new URL(cdnBaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: cdnHostname
      ? [
          {
            protocol: "https",
            hostname: cdnHostname,
          },
        ]
      : [],
  },
};

export default nextConfig;
