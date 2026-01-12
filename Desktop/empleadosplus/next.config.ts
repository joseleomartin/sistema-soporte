import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración para descarga de PDFs
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Optimizaciones para Vercel
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Configuración de imágenes (si se necesitan en el futuro)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
