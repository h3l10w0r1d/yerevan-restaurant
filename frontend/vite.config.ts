import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Public address of the site, used for canonical URLs, the sitemap and share previews.
// Change SITE_URL (env) when the site moves to its own domain.
const SITE_URL = (process.env.SITE_URL || 'https://yerevan-restaurant.vercel.app').replace(/\/$/, '')

/** Fills %SITE_URL% in index.html and writes robots.txt + sitemap.xml at build time. */
function seo(): Plugin {
  const pages = ['/', '/menu']
  const today = new Date().toISOString().slice(0, 10)
  const url = (path: string, lang?: string) => `${SITE_URL}${path}${lang === 'nl' ? '?lang=nl' : ''}`
  const alternates = (path: string) =>
    ['en', 'nl'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(path, l)}"/>`).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url(path)}"/>`
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.flatMap((p) => ['en', 'nl'].map((l) => `  <url>
    <loc>${url(p, l)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p === '/menu' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
${alternates(p)}
  </url>`)).join('\n')}
</urlset>
`
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
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
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
