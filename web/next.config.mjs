/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export a fully static app for React Onchain.
  // Next will write the final static bundle into `out/` on `next build`.
  output: 'export',
  // Disable built-in image optimization since we’re exporting static assets.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
