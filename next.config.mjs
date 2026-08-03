/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@merninos/ui"],

  // The Next dev-tools indicator renders into a `nextjs-portal` host whose hit
  // area can cover the viewport, so `elementFromPoint()` at the centre of an
  // ordinary button returns NEXTJS-PORTAL and Playwright retries the click
  // until the test times out. It took out 49 tests across baselines,
  // inventory, components and auth setup in one run.
  //
  // Only ever disabled for the e2e dev server, which sets PLAYWRIGHT=1 in
  // `playwright.config.ts`. A normal `next dev` keeps the indicator.
  ...(process.env.PLAYWRIGHT === "1" ? { devIndicators: false } : {}),
}

export default nextConfig
