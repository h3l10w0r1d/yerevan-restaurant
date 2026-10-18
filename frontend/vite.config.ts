import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Public address of the site, used for canonical URLs, the sitemap and share previews.
// Change SITE_URL (env) when the site moves to its own domain.
const SITE_URL = (process.env.SITE_URL || 'https://www.yerevanrestaurant.nl').replace(/\/$/, '')

/** Fills %SITE_URL% in index.html and writes robots.txt at build time.
 *  The sitemap is served by the API (/sitemap.xml) so it always lists the latest blog posts. */
function seo(): Plugin {
  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Allow: /api/images/

Sitemap: ${SITE_URL}/sitemap.xml
`
  return {
    name: 'yerevan-seo',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
  }
}

// BASE_PATH is set by the GitHub Pages workflow (e.g. /yerevan-restaurant/).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(SITE_URL) },
  plugins: [react(), seo()],
  server: {
    proxy: { '/api': process.env.API_PROXY || 'http://localhost:8000' },
    fs: { allow: ['..'] },
  },
})
