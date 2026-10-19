import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ExternalLink, FileText, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api, imageUrl } from '@/lib/api'
import type { BlogTag, PostListItem } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'
import { cn } from '@/lib/utils'
import '@/components/blog/ghost.css'

const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://www.yerevanrestaurant.nl'
const utc = (iso: string) => parseISO(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
const ago = (iso: string) => formatDistanceToNow(utc(iso), { addSuffix: true })

const TYPES = [
  { value: 'all', label: 'All posts' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'featured', label: 'Featured' },
]
const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'updated', label: 'Recently updated' },
]

function Filter({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { value: string; label: string }[] }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger size="sm" className="min-w-32"><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export function Posts() {
  const navigate = useNavigate()
  const [type, setType] = useState('all')
  const [author, setAuthor] = useState('all')
  const [tag, setTag] = useState('all')
  const [sort, setSort] = useState('newest')
  const { data: tags } = useFetch(() => api.get<BlogTag[]>('/admin/tags'))
  const { data: authors } = useFetch(() => api.get<{ id: number; name: string }[]>('/admin/authors'))
  const { data: posts, loading } = useFetch(() => {
    const q = new URLSearchParams({ sort })
    if (type === 'featured') q.set('featured', 'true')
    else if (type !== 'all') q.set('status', type)
    if (author !== 'all') q.set('author', author)
    if (tag !== 'all') q.set('tag', tag)
    return api.get<PostListItem[]>(`/admin/posts?${q}`)
  }, [type, author, tag, sort])

  const filtered = type !== 'all' || author !== 'all' || tag !== 'all'

  return (
    <div className="gh-posts mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="gh-posts__title">Posts</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Filter value={type} onChange={setType} items={TYPES} />
          <Filter value={author} onChange={setAuthor} items={[{ value: 'all', label: 'All authors' }, ...(authors ?? []).map((a) => ({ value: String(a.id), label: a.name }))]} />
          <Filter value={tag} onChange={setTag} items={[{ value: 'all', label: 'All tags' }, ...(tags ?? []).map((t) => ({ value: t.slug, label: t.name }))]} />
          <Filter value={sort} onChange={setSort} items={SORTS} />
          <Button nativeButton={false} render={<Link to="/posts/new" />} className="gh-new"><Plus /> New post</Button>
        </div>
      </div>

      {loading && !posts ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !posts?.length ? (
        <div className="gh-empty">
          <FileText />
          <h2>{filtered ? 'No posts match the current filter' : 'Start creating content.'}</h2>
          {!filtered && <p>Share stories from the kitchen, Armenian traditions and news about the restaurant. Good posts bring guests from Google.</p>}
          {filtered
            ? <Button variant="outline" onClick={() => { setType('all'); setAuthor('all'); setTag('all') }}>Show all posts</Button>
            : <Button onClick={() => navigate('/posts/new')}><Plus /> Write your first post</Button>}
        </div>
      ) : (
        <ol className="gh-list">
          <li className="gh-list__head"><span>Title</span><span>Status</span></li>
          {posts.map((p) => {
            const state = p.scheduled ? 'scheduled' : p.status
            return (
              <li key={p.id} className="gh-list__row">
                <Link to={`/posts/${p.id}`} className="gh-list__main">
                  {p.feature_image ? <img src={imageUrl(p.feature_image)} alt="" /> : <span className="gh-list__ph" />}
                  <span className="min-w-0">
                    <strong>{p.featured && <Star className="gh-list__star" />}{p.title || '(Untitled)'}</strong>
                    <span className="gh-list__meta">
                      By {p.author?.name ?? 'Unknown'}{p.tags[0] && <> in <b>{p.tags[0].name}</b></>} · {state === 'draft' ? `edited ${ago(p.updated_at)}` : state === 'scheduled' ? `scheduled for ${format(utc(p.published_at!), 'd MMM yyyy, HH:mm')}` : `published ${ago(p.published_at!)}`}
                    </span>
                  </span>
                </Link>
                <span className="gh-list__side">
                  <span className={cn('gh-list__status', `is-${state}`)}>{state === 'draft' ? 'Draft' : state === 'scheduled' ? 'Scheduled' : 'Published'}</span>
                  {state === 'published' && (
                    <a href={`${PUBLIC_URL}/blog/${p.slug}`} target="_blank" rel="noreferrer" className="gh-list__view" aria-label="View on website"><ExternalLink /></a>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
