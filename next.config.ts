import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: false, // 启用 PWA
  register: true, // 自动注册 Service Worker
  workboxOptions: {
    skipWaiting: true, // 跳过等待，立即激活
    runtimeCaching: [
      {
        urlPattern: /^https?.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "offlineCache",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 24 * 60 * 60, // 24 小时
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  reactStrictMode: true,
};

export default withPWA(nextConfig);
