import { ChevronLeft, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api, describe } from '@/lib/api'
import type { BlogTag } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'
import { cn } from '@/lib/utils'
import '@/components/blog/ghost.css'

const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://www.yerevanrestaurant.nl'
const HOST = new URL(PUBLIC_URL).host

export function Tags() {
  const { data: tags, loading } = useFetch(() => api.get<BlogTag[]>('/admin/tags'))
  return (
    <div className="gh-posts mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="gh-posts__title">Tags</h1>
        <Button nativeButton={false} render={<Link to="/tags/new" />}><Plus /> New tag</Button>
      </div>
      {loading && !tags ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !tags?.length ? (
        <div className="gh-empty">
          <TagIcon />
          <h2>Start organising your content.</h2>
          <p>Tags group posts into topics like “Recipes”, “Armenian culture” or “News”. Each tag gets its own page that can rank in search.</p>
          <Button nativeButton={false} render={<Link to="/tags/new" />}><Plus /> Create a new tag</Button>
        </div>
      ) : (
        <ol className="gh-list">
          <li className="gh-list__head"><span>Tag</span><span>No. of posts</span></li>
          {tags.map((t) => (
            <li key={t.id} className="gh-list__row">
              <Link to={`/tags/${t.id}`} className="gh-list__main">
                <span className="gh-list__dot" style={{ background: t.color || 'var(--muted-foreground)' }} />
                <span className="min-w-0">
                  <strong>{t.name}</strong>
                  <span className="gh-list__meta">/blog/tag/{t.slug}{t.description && ` · ${t.description}`}</span>
                </span>
              </Link>
              <span className="gh-list__side"><span className="gh-list__status">{t.count} {t.count === 1 ? 'post' : 'posts'}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

type TagForm = { name: string; slug: string; description: string; color: string; meta_title: string; meta_description: string }
const EMPTY: TagForm = { name: '', slug: '', description: '', color: '#b0473b', meta_title: '', meta_description: '' }

const Count = ({ v, max }: { v: string; max: number }) => (
  <span className={cn('text-xs', v.length > max ? 'text-destructive' : 'text-muted-foreground')}>{v.length}/{max}</span>
)

export function TagEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [form, setForm] = useState<TagForm>(EMPTY)
  const [loaded, setLoaded] = useState(isNew)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof TagForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (isNew) return
    api.get<BlogTag>(`/admin/tags/${id}`).then((t) => {
      setForm({ name: t.name, slug: t.slug, description: t.description ?? '', color: t.color ?? '#b0473b', meta_title: t.meta_title ?? '', meta_description: t.meta_description ?? '' })
      setLoaded(true)
    }).catch((e) => { toast.error(describe(e)); navigate('/tags') })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { ...form, slug: form.slug || null }
      const t = isNew ? await api.post<BlogTag>('/admin/tags', body) : await api.put<BlogTag>(`/admin/tags/${id}`, body)
      setForm((f) => ({ ...f, slug: t.slug }))
      toast.success(isNew ? 'Tag created' : 'Tag saved')
      if (isNew) navigate(`/tags/${t.id}`, { replace: true })
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the tag “${form.name}”? Posts keep their content but lose this tag.`)) return
    try {
      await api.del(`/admin/tags/${id}`)
      toast.success('Tag deleted')
      navigate('/tags')
    } catch (err) { toast.error(describe(err)) }
  }

  if (!loaded) return <Skeleton className="mx-auto h-96 w-full max-w-3xl" />

  const slug = form.slug || form.name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const title = form.meta_title || `${form.name || 'Tag'} · Yerevan`
  const desc = form.meta_description || form.description || 'Add a description to control the text Google shows under your link.'

  return (
    <form onSubmit={submit} className="gh-posts mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/tags" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Tags</Link>
          <h1 className="gh-posts__title">{isNew ? 'New tag' : form.name || 'Tag'}</h1>
        </div>
        <Button type="submit" disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>

      <Card>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-[1fr_120px]">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus={isNew} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-color">Colour</Label>
            <div className="flex items-center gap-2">
              <input id="tag-color" type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
              <span className="text-xs text-muted-foreground">{form.color}</span>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tag-slug">Slug</Label>
            <Input id="tag-slug" value={form.slug} placeholder={slug} onChange={(e) => set('slug', e.target.value)} spellCheck={false} />
            <p className="text-xs text-muted-foreground">{HOST}/blog/tag/{slug || '…'}/</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex justify-between"><Label htmlFor="tag-desc">Description</Label><Count v={form.description} max={500} /></div>
            <Textarea id="tag-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Shown at the top of the tag page" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta data</CardTitle>
          <CardDescription>How this tag page appears in search engines.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between"><Label htmlFor="tag-mt">Meta title</Label><Count v={form.meta_title} max={60} /></div>
              <Input id="tag-mt" value={form.meta_title} placeholder={`${form.name} · Yerevan`} onChange={(e) => set('meta_title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><Label htmlFor="tag-md">Meta description</Label><Count v={form.meta_description} max={145} /></div>
              <Textarea id="tag-md" rows={4} value={form.meta_description} placeholder={form.description} onChange={(e) => set('meta_description', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Search engine result preview</Label>
            <div className="gh-serp bg-white">
              <div className="gh-serp__site"><span className="gh-serp__fav" />{HOST}<span className="gh-serp__crumb"> › blog › tag › {slug}</span></div>
              <div className="gh-serp__title">{title.length > 62 ? `${title.slice(0, 60)}…` : title}</div>
              <div className="gh-serp__desc">{desc.length > 158 ? `${desc.slice(0, 155)}…` : desc}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && (
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 /> Delete tag</Button>
      )}
    </form>
  )
}
