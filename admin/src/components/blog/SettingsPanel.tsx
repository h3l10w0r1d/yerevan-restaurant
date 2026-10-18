import { format, parseISO } from 'date-fns'
import { Check as CheckIcon, ChevronLeft, ChevronRight, ImagePlus, Trash2, X as XIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { imageUrl } from '@/lib/api'
import type { BlogTag, PostFields } from '@/lib/types'
import { cn } from '@/lib/utils'
import { seoChecks, seoScore } from './seo'
import { pickImage, uploadImage } from './uploads'

type View = 'main' | 'meta' | 'twitter' | 'facebook' | 'seo'
type Props = {
  post: PostFields
  set: <K extends keyof PostFields>(k: K, v: PostFields[K]) => void
  tags: BlogTag[]
  createTag: (name: string) => Promise<BlogTag | null>
  authors: { id: number; name: string }[]
  plain: string
  siteUrl: string
  onDelete: () => void
  onClose: () => void
}

const counter = (value: string | null | undefined, max: number) => {
  const n = (value ?? '').length
  return <span className={cn('gh-counter', n > max && 'is-over')}>{n}/{max}</span>
}

export function SettingsPanel(props: Props) {
  const [view, setView] = useState<View>('main')
  const { post } = props
  const host = new URL(props.siteUrl).host
  const checks = useMemo(() => seoChecks(post, props.plain, post.html, host), [post, props.plain, host])
  const score = seoScore(checks)

  return (
    <aside className="gh-psm" aria-label="Post settings">
      {view === 'main' && <Main {...props} score={score} go={setView} />}
      {view !== 'main' && (
        <header className="gh-psm__head">
          <button type="button" className="gh-psm__back" onClick={() => setView('main')}><ChevronLeft /> </button>
          <h3>{{ meta: 'Meta data', twitter: 'X card', facebook: 'Facebook card', seo: 'SEO checklist' }[view]}</h3>
          <span />
        </header>
      )}
      {view === 'meta' && <MetaView {...props} host={host} />}
      {view === 'twitter' && <SocialView {...props} kind="twitter" host={host} />}
      {view === 'facebook' && <SocialView {...props} kind="og" host={host} />}
      {view === 'seo' && <SeoView {...props} checks={checks} score={score} />}
    </aside>
  )
}

function Main({ post, set, tags, createTag, authors, siteUrl, onDelete, onClose, score, go }: Props & { score: number; go: (v: View) => void }) {
  const published = post.published_at ? parseISO(post.published_at) : null
  const setDate = (date: string, time: string) => {
    if (!date) return set('published_at', null)
    set('published_at', new Date(`${date}T${time || '12:00'}:00`).toISOString())
  }
  return (
    <>
      <header className="gh-psm__head">
        <h3>Post settings</h3>
        <button type="button" className="gh-psm__close" onClick={onClose} aria-label="Close settings"><XIcon /></button>
      </header>
      <div className="gh-psm__body">
        <Field label="Post URL">
          <input value={post.slug} onChange={(e) => set('slug', e.target.value)} spellCheck={false} />
          <a className="gh-psm__hint gh-psm__url" href={`${siteUrl}/blog/${post.slug}`} target="_blank" rel="noreferrer">
            {siteUrl.replace(/^https?:\/\//, '')}/blog/{post.slug}/
          </a>
        </Field>

        <Field label="Publish date">
          <div className="gh-psm__row">
            <input type="date" value={published ? format(published, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDate(e.target.value, published ? format(published, 'HH:mm') : '12:00')} />
            <input type="time" value={published ? format(published, 'HH:mm') : ''}
              onChange={(e) => setDate(published ? format(published, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'), e.target.value)} />
          </div>
          <span className="gh-psm__hint">Leave empty to use the moment you publish. A future date schedules the post.</span>
        </Field>

        <Field label="Tags">
          <TagInput value={post.tag_ids} onChange={(ids) => set('tag_ids', ids)} tags={tags} createTag={createTag} />
          <span className="gh-psm__hint">The first tag is the primary tag, shown on the post.</span>
        </Field>

        <Field label="Excerpt" extra={counter(post.custom_excerpt, 300)}>
          <textarea rows={3} maxLength={300} value={post.custom_excerpt ?? ''} onChange={(e) => set('custom_excerpt', e.target.value)}
            placeholder="A short summary shown on the blog and in search results" />
        </Field>

        <div className="gh-psm__row">
          <Field label="Author">
            <select value={post.author_id ?? ''} onChange={(e) => set('author_id', e.target.value ? Number(e.target.value) : null)}>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Language">
            <select value={post.language} onChange={(e) => set('language', e.target.value as 'en' | 'nl')}>
              <option value="nl">Nederlands</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>

        <label className="gh-psm__switch">
          <span>Feature this post</span>
          <input type="checkbox" checked={post.featured} onChange={(e) => set('featured', e.target.checked)} />
          <span className="gh-toggle-ui" aria-hidden />
        </label>

        <nav className="gh-psm__nav">
          <button type="button" onClick={() => go('seo')}>
            <span>SEO checklist</span>
            <span className={cn('gh-score', score >= 80 ? 'is-good' : score >= 50 ? 'is-ok' : 'is-bad')}>{score}</span>
            <ChevronRight />
          </button>
          <button type="button" onClick={() => go('meta')}><span>Meta data</span><span className="gh-psm__sub">Extra content for search engines</span><ChevronRight /></button>
          <button type="button" onClick={() => go('twitter')}><span>X card</span><span className="gh-psm__sub">Customise X (Twitter) previews</span><ChevronRight /></button>
          <button type="button" onClick={() => go('facebook')}><span>Facebook card</span><span className="gh-psm__sub">Customise Facebook, WhatsApp, LinkedIn</span><ChevronRight /></button>
        </nav>

        <button type="button" className="gh-psm__delete" onClick={onDelete}><Trash2 /> Delete post</button>
      </div>
    </>
  )
}

function MetaView({ post, set, siteUrl, host }: Props & { host: string }) {
  const title = post.meta_title || post.title || 'Post title'
  const desc = post.meta_description || post.custom_excerpt || 'Add a meta description to control the text Google shows under your link.'
  return (
    <div className="gh-psm__body">
      <Field label="Meta title" extra={counter(post.meta_title, 60)}>
        <input value={post.meta_title ?? ''} placeholder={post.title} onChange={(e) => set('meta_title', e.target.value)} />
        <span className="gh-psm__hint">Recommended: 60 characters. Defaults to the post title.</span>
      </Field>
      <Field label="Meta description" extra={counter(post.meta_description, 145)}>
        <textarea rows={4} value={post.meta_description ?? ''} placeholder={post.custom_excerpt ?? ''} onChange={(e) => set('meta_description', e.target.value)} />
        <span className="gh-psm__hint">Recommended: 145 characters. Defaults to the excerpt.</span>
      </Field>
      <Field label="Focus keyword">
        <input value={post.focus_keyword ?? ''} placeholder="e.g. Armeens restaurant Hilversum" onChange={(e) => set('focus_keyword', e.target.value)} />
      </Field>
      <div className="gh-preview-label">Search engine result preview</div>
      <div className="gh-serp">
        <div className="gh-serp__site"><span className="gh-serp__fav" />{post.canonical_url ? new URL(post.canonical_url).host : host}<span className="gh-serp__crumb"> › blog › {post.slug}</span></div>
        <div className="gh-serp__title">{title.length > 62 ? `${title.slice(0, 60)}…` : title}</div>
        <div className="gh-serp__desc">{desc.length > 158 ? `${desc.slice(0, 155)}…` : desc}</div>
      </div>
      <Field label="Canonical URL">
        <input value={post.canonical_url ?? ''} placeholder={`${siteUrl}/blog/${post.slug}`} onChange={(e) => set('canonical_url', e.target.value)} />
        <span className="gh-psm__hint">Only if this post was first published elsewhere.</span>
      </Field>
    </div>
  )
}

function SocialView({ post, set, kind, host }: Props & { kind: 'twitter' | 'og'; host: string }) {
  const k = (s: 'title' | 'description' | 'image') => `${kind}_${s}` as keyof PostFields
  const title = (post[k('title')] as string) || post.meta_title || post.title || 'Post title'
  const desc = (post[k('description')] as string) || post.meta_description || post.custom_excerpt || ''
  const image = (post[k('image')] as string) || post.feature_image
  const upload = async () => {
    const f = await pickImage()
    const url = f && await uploadImage(f)
    if (url) set(k('image'), url as never)
  }
  return (
    <div className="gh-psm__body">
      <div className={cn('gh-social', kind === 'twitter' ? 'gh-social--x' : 'gh-social--fb')}>
        <button type="button" className="gh-social__img" onClick={upload}>
          {image ? <img src={imageUrl(image)} alt="" /> : <span><ImagePlus /> Add image</span>}
        </button>
        <div className="gh-social__text">
          {kind === 'og' && <div className="gh-social__host">{host.toUpperCase()}</div>}
          <div className="gh-social__title">{title}</div>
          <div className="gh-social__desc">{desc}</div>
          {kind === 'twitter' && <div className="gh-social__host">{host}</div>}
        </div>
      </div>
      {post[k('image')] && <button type="button" className="gh-psm__link" onClick={() => set(k('image'), null as never)}>Remove custom image</button>}
      <Field label={kind === 'twitter' ? 'X title' : 'Facebook title'}>
        <input value={(post[k('title')] as string) ?? ''} placeholder={post.meta_title || post.title} onChange={(e) => set(k('title'), e.target.value as never)} />
      </Field>
      <Field label={kind === 'twitter' ? 'X description' : 'Facebook description'}>
        <textarea rows={3} value={(post[k('description')] as string) ?? ''} placeholder={post.meta_description || post.custom_excerpt || ''}
          onChange={(e) => set(k('description'), e.target.value as never)} />
      </Field>
      <span className="gh-psm__hint">Defaults to the meta data and feature image when left empty. Image: 1200 × 630 works everywhere.</span>
    </div>
  )
}

function SeoView({ post, set, checks, score }: Props & { checks: ReturnType<typeof seoChecks>; score: number }) {
  return (
    <div className="gh-psm__body">
      <div className="gh-seo-score">
        <span className={cn('gh-score gh-score--lg', score >= 80 ? 'is-good' : score >= 50 ? 'is-ok' : 'is-bad')}>{score}</span>
        <p>{score >= 80 ? 'Great: this post is well optimised.' : score >= 50 ? 'Good start. Fix the items below to rank better.' : 'Needs work before it can rank well.'}</p>
      </div>
      <Field label="Focus keyword">
        <input value={post.focus_keyword ?? ''} placeholder="e.g. Armeens restaurant Hilversum" onChange={(e) => set('focus_keyword', e.target.value)} />
      </Field>
      <ul className="gh-checks">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? 'is-ok' : 'is-bad'}>
            <span className="gh-checks__icon">{c.ok ? <CheckIcon /> : <XIcon />}</span>
            <span><strong>{c.label}</strong>{!c.ok && c.hint && <em>{c.hint}</em>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Field({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="gh-field">
      <div className="gh-field__label"><label>{label}</label>{extra}</div>
      {children}
    </div>
  )
}

function TagInput({ value, onChange, tags, createTag }: {
  value: number[]; onChange: (ids: number[]) => void; tags: BlogTag[]; createTag: (name: string) => Promise<BlogTag | null>
}) {
  const [q, setQ] = useState('')
  const selected = value.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as BlogTag[]
  const options = tags.filter((t) => !value.includes(t.id) && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
  const exact = tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase())
  const add = async () => {
    const name = q.trim()
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    const tag = existing ?? await createTag(name)
    if (tag && !value.includes(tag.id)) onChange([...value, tag.id])
    setQ('')
  }
  return (
    <div className="gh-tags">
      <div className="gh-tags__box">
        {selected.map((t, i) => (
          <span key={t.id} className={cn('gh-tag', i === 0 && 'is-primary')}>
            {t.name}
            <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onChange(value.filter((id) => id !== t.id))}><XIcon /></button>
          </span>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={selected.length ? '' : 'Add tags…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
            if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1))
          }} />
      </div>
      {q && (
        <div className="gh-tags__menu">
          {options.map((t) => (
            <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange([...value, t.id]); setQ('') }}>{t.name}</button>
          ))}
          {!exact && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={add}>+ Create “{q.trim()}”</button>}
        </div>
      )}
    </div>
  )
}
