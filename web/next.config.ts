import type { NextConfig } from "next";

// Static export for GitHub Pages. The site is served under /<repo-name>/,
// so the workflow passes NEXT_PUBLIC_BASE_PATH=/<repo-name>; local dev uses "".
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true, // /chi-tiet/ -> chi-tiet/index.html, which Pages serves directly
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
