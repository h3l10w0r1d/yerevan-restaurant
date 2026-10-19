import { useEffect, useState, type MouseEvent } from 'react'
import { ApiError, blogApi, img, type BlogTag, type PostCard, type PostFull } from '../api'
import { fill, useI18n, type Lang } from '../i18n'
import { useReserveWidget } from '../reserve-widget'
import { Link, useRouter } from '../router'
import '../blog.css'

const SITE = (import.meta.env.VITE_SITE_URL as string).replace(/\/$/, '')
const utc = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const fmtDate = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(utc(iso))

/** Keeps the head in step during in-app navigation (the server renders it for the first load and for crawlers). */
function useBlogHead(head: { title: string; description: string; path: string; image?: string | null; type?: string; noindex?: boolean } | null) {
  useEffect(() => {
    if (!head) return
    const set = (sel: string, attr: string, value: string) => document.head.querySelector(sel)?.setAttribute(attr, value)
    const url = head.path.startsWith('http') ? head.path : `${SITE}${head.path}`
    document.title = head.title
    set('meta[name="description"]', 'content', head.description)
    set('link[rel="canonical"]', 'href', url)
    set('meta[property="og:title"]', 'content', head.title)
    set('meta[property="og:description"]', 'content', head.description)
    set('meta[property="og:url"]', 'content', url)
    set('meta[property="og:type"]', 'content', head.type ?? 'website')
    if (head.image) set('meta[property="og:image"]', 'content', head.image.startsWith('http') ? head.image : `${SITE}${img(head.image).replace(/^https?:\/\/[^/]+/, '')}`)
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (head.noindex) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
      robots.content = 'noindex'
    } else robots?.remove()
  }, [head?.title, head?.description, head?.path, head?.image, head?.type, head?.noindex]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** /blog and /blog/tag/:slug */
export function BlogIndex({ tag }: { tag?: string }) {
  const { t, lang } = useI18n()
  const [tags, setTags] = useState<BlogTag[]>([])
  const [current, setCurrent] = useState<BlogTag | null>(null)
  const [posts, setPosts] = useState<PostCard[] | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => { blogApi.tags().then(setTags).catch(() => {}) }, [])
  useEffect(() => {
    setPosts(null); setPage(1); setMissing(false); setCurrent(null)
    if (tag) blogApi.tag(tag).then(setCurrent).catch(() => setMissing(true))
    blogApi.posts(1, tag).then((r) => { setPosts(r.posts); setPages(r.pagination.pages) })
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setMissing(true); setPosts([]) })
  }, [tag])

  const more = async () => {
    setBusy(true)
    try {
      const r = await blogApi.posts(page + 1, tag)
      setPosts((p) => [...(p ?? []), ...r.posts])
      setPage(page + 1)
    } finally { setBusy(false) }
  }

  useBlogHead(tag
    ? current && { title: current.meta_title || `${current.name} · Yerevan blog`, description: current.meta_description || current.description || t.blog.intro, path: `/blog/tag/${current.slug}` }
    : { title: lang === 'nl' ? 'Blog · Yerevan, Armeens restaurant in Hilversum' : 'Blog · Yerevan, Armenian restaurant in Hilversum', description: t.blog.intro, path: '/blog' })

  // Only the main topics: the most-used tags, plus the one being viewed.
  const chips = tags.filter((x) => (x.count ?? 0) >= 3 || x.slug === tag).sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 10)
  const [lead, ...rest] = posts ?? []
  const hero = !tag && lead?.featured ? lead : null
  const grid = hero ? rest : posts ?? []

  return (
    <main className="blog">
      <header className="blog-head container">
        <p className="eyebrow">{tag ? <Link to="/blog">{t.blog.eyebrow}</Link> : t.blog.eyebrow}</p>
        <h1>{tag ? current?.name ?? (missing ? t.blog.notFound : '…') : t.blog.title}</h1>
        <p className="lead">{tag ? current?.description ?? '' : t.blog.intro}</p>
        {chips.length > 0 && (
          <nav className="blog-tags" aria-label="Tags">
            <Link to="/blog" aria-current={!tag ? 'page' : undefined}>{t.blog.all}</Link>
            {chips.map((x) => <Link key={x.id} to={`/blog/tag/${x.slug}`} aria-current={x.slug === tag ? 'page' : undefined}>{x.name}</Link>)}
          </nav>
        )}
      </header>

      <div className="container">
        {posts === null ? (
          <div className="blog-grid" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="post-card post-card--skeleton" />)}</div>
        ) : posts.length === 0 ? (
          <p className="blog-empty">{missing ? t.blog.notFound : t.blog.empty}</p>
        ) : (
          <>
            {hero && <Card post={hero} lang={lang} big />}
            <div className="blog-grid">{grid.map((p) => <Card key={p.id} post={p} lang={lang} />)}</div>
            {page < pages && (
              <div className="blog-more"><button type="button" className="btn blog-btn" onClick={more} disabled={busy}>{busy ? t.blog.loading : t.blog.more}</button></div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function Card({ post, lang, big }: { post: PostCard; lang: Lang; big?: boolean }) {
  const { t } = useI18n()
  return (
    <article className={`post-card ${big ? 'post-card--big' : ''}`}>
      <Link to={`/blog/${post.slug}`} className="post-card__link">
        <div className="post-card__media">
          {post.feature_image
            ? <img src={img(post.feature_image)} alt={post.feature_image_alt ?? ''} loading={big ? 'eager' : 'lazy'} />
            : <span className="post-card__ph" aria-hidden>Ե</span>}
        </div>
        <div className="post-card__body">
          {(post.primary_tag || (big && post.featured)) && (
            <p className="post-card__tag">{big && post.featured ? t.blog.featured : post.primary_tag?.name}</p>
          )}
          <h2 className="post-card__title">{post.title}</h2>
          <p className="post-card__excerpt">{post.excerpt}</p>
          <p className="post-card__meta">
            <time dateTime={utc(post.published_at).toISOString()}>{fmtDate(post.published_at, lang)}</time>
            <span aria-hidden> · </span>{fill(t.blog.readingTime, { n: post.reading_time })}
          </p>
        </div>
      </Link>
    </article>
  )
}

/** /blog/:slug, and /blog/p/:uuid for previews from the admin. */
export function BlogPost({ slug, preview }: { slug?: string; preview?: string }) {
  const { t, lang } = useI18n()
  const { navigate } = useRouter()
  const reserve = useReserveWidget()
  const [post, setPost] = useState<PostFull | null>(null)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setPost(null); setMissing(false)
    const load = preview ? blogApi.preview(preview) : blogApi.post(slug!)
    load.then(setPost).catch(() => setMissing(true))
  }, [slug, preview])

  useBlogHead(post && {
    title: post.meta_title || `${post.title} · Yerevan`,
    description: post.meta_description || post.excerpt,
    path: post.canonical_url || `/blog/${post.slug}`,
    image: post.og_image || post.feature_image,
    type: 'article',
    noindex: !!preview,
  })

  // Links inside the article stay in the app; "/#reserve" opens the booking popup.
  const onArticleClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (!a || !href || e.metaKey || e.ctrlKey || a.target === '_blank') return
    if (href === '/#reserve' || href === '#reserve') { e.preventDefault(); reserve.show(); return }
    if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api')) { e.preventDefault(); navigate(href) }
  }

  if (missing) {
    return (
      <main className="blog container container--narrow blog-missing">
        <h1>{t.blog.notFound}</h1>
        <Link to="/blog" className="btn blog-btn">{t.blog.back}</Link>
      </main>
    )
  }
  if (!post) return <main className="blog" aria-busy="true"><div className="article-skeleton container container--narrow" /></main>

  const url = `${SITE}/blog/${post.slug}`
  const share = [
    ['X', `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
  ]

  return (
    <main className="blog">
      {post.preview && <div className="blog-preview-bar">{t.blog.preview}</div>}
      <article className="article" lang={post.language}>
        <header className="article__head container container--narrow">
          <nav className="article__crumbs" aria-label="Breadcrumb">
            <Link to="/blog">{t.blog.eyebrow}</Link>
            {post.primary_tag && <><span aria-hidden>/</span><Link to={`/blog/tag/${post.primary_tag.slug}`}>{post.primary_tag.name}</Link></>}
          </nav>
          <h1 className="article__title">{post.title}</h1>
          {post.custom_excerpt && <p className="article__excerpt">{post.custom_excerpt}</p>}
          <p className="article__meta">
            {post.author && <>{t.blog.by} <strong>{post.author.name}</strong><span aria-hidden> · </span></>}
            <time dateTime={utc(post.published_at).toISOString()}>{fmtDate(post.published_at, lang)}</time>
            <span aria-hidden> · </span>{fill(t.blog.readingTime, { n: post.reading_time })}
          </p>
        </header>

        {post.feature_image && (
          <figure className="article__feature">
            <img src={img(post.feature_image)} alt={post.feature_image_alt ?? ''} fetchPriority="high" />
            {post.feature_image_caption && <figcaption>{post.feature_image_caption}</figcaption>}
          </figure>
        )}

        <div className="gh-content-public container container--narrow" onClick={onArticleClick} dangerouslySetInnerHTML={{ __html: post.html }} />

        <footer className="article__foot container container--narrow">
          {post.tags.length > 0 && (
            <ul className="article__tags">{post.tags.map((x) => <li key={x.id}><Link to={`/blog/tag/${x.slug}`}>{x.name}</Link></li>)}</ul>
          )}
          <div className="article__share">
            <span>{t.blog.share}</span>
            {share.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}
            <button type="button" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) }}>
              {copied ? t.blog.copied : t.blog.copy}
            </button>
          </div>
          <aside className="article__cta">
            <h2>{t.blog.ctaTitle}</h2>
            <p>{t.blog.ctaText}</p>
            <button type="button" className="btn blog-btn blog-btn--solid" onClick={() => reserve.show()}>{t.blog.ctaButton}</button>
          </aside>
        </footer>
      </article>

      {post.related.length > 0 && (
        <section className="blog-related container" aria-labelledby="related-title">
          <h2 id="related-title">{t.blog.related}</h2>
          <div className="blog-grid">{post.related.map((p) => <Card key={p.id} post={p} lang={lang} />)}</div>
        </section>
      )}
    </main>
  )
}
