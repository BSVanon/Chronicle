/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Export a fully static app.
  output: 'export',
  // Disable built-in image optimization since we’re exporting static assets.
  images: {
    unoptimized: true,
  },
  // When hosted on GitHub Pages at https://BSVanon.github.io/Chronicle/,
  // the app lives under the /Chronicle base path. Keep local dev at root.
  basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
};

export default nextConfig;
