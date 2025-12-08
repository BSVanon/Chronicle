/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Export a fully static app.
  output: 'export',
  // Disable built-in image optimization since we’re exporting static assets.
  images: {
    unoptimized: true,
  },
  // When hosted on GitHub Pages at https://BSVanon.github.io/Chronicle/,
  // the app lives under the /Chronicle base path. Keep local dev at root.
  basePath: isProd ? '/Chronicle' : '',
  assetPrefix: isProd ? '/Chronicle/' : '',
};

export default nextConfig;
