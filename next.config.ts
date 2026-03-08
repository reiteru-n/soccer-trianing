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
};

export default nextConfig;
