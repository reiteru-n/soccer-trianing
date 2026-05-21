import type { NextConfig } from "next";

function buildVersionJST() {
  const now = new Date();
  const t = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  return `${t.getUTCFullYear()}${String(t.getUTCMonth()+1).padStart(2,'0')}${String(t.getUTCDate()).padStart(2,'0')}${String(t.getUTCHours()).padStart(2,'0')}${String(t.getUTCMinutes()).padStart(2,'0')}`;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildVersionJST(),
  },
  async headers() {
    return [
      {
        source: '/app.apk',
        headers: [
          { key: 'Content-Type',        value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition', value: 'attachment; filename="soccer-training.apk"' },
          { key: 'Cache-Control',       value: 'public, max-age=300' },
        ],
      },
    ];
  },
};

export default nextConfig;
