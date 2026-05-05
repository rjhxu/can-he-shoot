/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid SegmentViewNode / client-manifest errors during dev HMR when switching players or reloading.
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
