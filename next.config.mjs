/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Файловые загрузки идут через route handlers; поднимаем лимит тела для multipart.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
