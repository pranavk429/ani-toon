import type { NextConfig } from 'next';

const isPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  // The default build is a normal Next app. The Pages workflow sets
  // GITHUB_PAGES=true to emit a fully static `out/` directory.
  output: isPages ? 'export' : undefined,
  basePath: isPages ? '/ani-toon' : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: isPages ? '/ani-toon' : '',
  },
  trailingSlash: isPages ? true : undefined,
  images: { unoptimized: true },
  cacheComponents: !isPages,
  partialPrefetching: !isPages,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
