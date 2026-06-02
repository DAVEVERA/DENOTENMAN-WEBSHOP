const path = require("path");

let withSentryConfig;
try {
  withSentryConfig = require("@sentry/nextjs").withSentryConfig;
} catch {
  withSentryConfig = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // ADR 0011: generate source maps for Sentry upload but do not serve them publicly.
  // Combined with sourcemaps.deleteSourcemapsAfterUpload, no maps remain in deploy.
  productionBrowserSourceMaps: false,
  transpilePackages: ["@denotenman/ui", "@denotenman/schemas", "@denotenman/utils"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "luablfcmhzykjnxmtlqh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// SENTRY_AUTH_TOKEN is a CI secret — omitting it disables source-map upload
// without failing the build (dev and preview scenario).
// ADR 0011: source maps uploaded to Sentry and deleted afterwards so no map
// files remain in the deployed bundle.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_ADMIN,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
});
