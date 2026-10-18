import type { PostFields } from '@/lib/types'

export type Check = { id: string; label: string; ok: boolean; hint?: string; weight: number }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** A Yoast-style checklist computed live from the post. */
export function seoChecks(p: PostFields, plain: string, html: string, siteHost: string): Check[] {
  const kw = norm((p.focus_keyword ?? '').trim())
  const title = p.meta_title || p.title
  const desc = p.meta_description || p.custom_excerpt || ''
  const words = plain.trim() ? plain.trim().split(/\s+/).length : 0
  const firstPara = norm(plain.split(/\n+/).find((l) => l.trim().length > 40) ?? plain.slice(0, 300))
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const imgs = [...doc.querySelectorAll('img')]
  const links = [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '')
  const internal = links.filter((h) => h.startsWith('/') || h.includes(siteHost))
  const headings = doc.querySelectorAll('h2, h3').length
  const kwInText = kw ? (norm(plain).match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length : 0
  const density = kw && words ? (kwInText * kw.split(/\s+/).length * 100) / words : 0

  const checks: Check[] = [
    { id: 'kw', label: 'Focus keyword set', ok: !!kw, hint: 'Pick the phrase people would search for, e.g. “Armeens restaurant Hilversum”.', weight: 1 },
    { id: 'title-len', label: `SEO title length (${title.length}/60)`, ok: title.length >= 30 && title.length <= 60, hint: 'Aim for 30–60 characters so Google shows it in full.', weight: 2 },
    { id: 'desc-len', label: `Meta description length (${desc.length}/155)`, ok: desc.length >= 70 && desc.length <= 160, hint: 'Write 70–160 characters; it becomes the text under your link in Google.', weight: 2 },
    { id: 'words', label: `Content length (${words} words)`, ok: words >= 300, hint: 'Posts with 300+ words have a much better chance to rank.', weight: 2 },
    { id: 'headings', label: 'Uses subheadings', ok: headings > 0, hint: 'Break the text up with H2/H3 headings.', weight: 1 },
    { id: 'feature', label: 'Feature image set', ok: !!p.feature_image, hint: 'Used in Google results, social shares and the blog list.', weight: 1 },
    { id: 'alt', label: imgs.length ? `Images have alt text (${imgs.filter((i) => i.alt.trim()).length}/${imgs.length})` : 'Images have alt text',
      ok: imgs.every((i) => i.alt.trim()) && (!p.feature_image || !!p.feature_image_alt?.trim()), hint: 'Describe every image, including the feature image.', weight: 1 },
    { id: 'internal', label: 'Links to your own pages', ok: internal.length > 0, hint: 'Link to the menu or reservations, e.g. /menu or a Button card.', weight: 1 },
    { id: 'slug', label: 'Short, readable URL', ok: !!p.slug && p.slug.length <= 75 && !p.slug.startsWith('draft-'), hint: 'Keep the URL short and descriptive.', weight: 1 },
  ]
  if (kw) {
    checks.push(
      { id: 'kw-title', label: 'Keyword in SEO title', ok: norm(title).includes(kw), hint: 'Put the focus keyword in the title, ideally near the start.', weight: 2 },
      { id: 'kw-desc', label: 'Keyword in meta description', ok: norm(desc).includes(kw), weight: 1 },
      { id: 'kw-slug', label: 'Keyword in URL', ok: norm(p.slug.replace(/-/g, ' ')).includes(kw), hint: 'Edit the Post URL to include it.', weight: 1 },
      { id: 'kw-intro', label: 'Keyword in the introduction', ok: firstPara.includes(kw), hint: 'Mention it in the first paragraph.', weight: 1 },
      { id: 'kw-density', label: `Keyword density (${density.toFixed(1)}%)`, ok: density >= 0.5 && density <= 3, hint: 'Use it naturally: about 0.5–3% of the text.', weight: 1 },
    )
  }
  return checks
}

export function seoScore(checks: Check[]) {
  const total = checks.reduce((n, c) => n + c.weight, 0)
  const got = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0)
  return Math.round((got / total) * 100)
}
