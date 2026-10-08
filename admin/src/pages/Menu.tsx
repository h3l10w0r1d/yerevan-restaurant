import { ArrowDown, ArrowUp, Eye, EyeOff, ImageOff, MoreHorizontal, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/image-upload'
import { cn } from '@/lib/utils'
import { api, describe, imageUrl } from '@/lib/api'
import { euro } from '@/lib/format'
import type { Category, MenuItem } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

type MenuData = { categories: Category[]; items: MenuItem[] }
type ItemForm = Omit<MenuItem, 'id' | 'position'>

const TAGS = [{ id: 'v', label: 'Vegetarian' }, { id: 'vg', label: 'Vegan' }]
const BADGES = [
  { value: 'none', label: 'No badge' },
  { value: 'popular', label: 'Popular' },
  { value: 'signature', label: 'Signature' },
  { value: 'new', label: 'New' },
  { value: 'spicy', label: 'Spicy' },
]
const BADGE_LABEL: Record<string, string> = { popular: 'Popular', signature: 'Signature', new: 'New', spicy: 'Spicy' }

export function Menu() {
  const { data, loading, reload, setData } = useFetch(() => api.get<MenuData>('/admin/menu'))
  const [query, setQuery] = useState('')
  const [itemSheet, setItemSheet] = useState<{ open: boolean; item?: MenuItem | null; categoryId?: string }>({ open: false })
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: Category | null }>({ open: false })
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => Promise<void> } | null>(null)

  const cats = data?.categories ?? []
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.items ?? []).filter((i) => !q || `${i.name_en} ${i.name_nl} ${i.description_en}`.toLowerCase().includes(q))
  }, [data, query])

  async function toggleAvailable(item: MenuItem, available: boolean) {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, available } : i)) })
    try {
      const { id: _id, position: _p, ...rest } = item
      await api.put(`/admin/items/${item.id}`, { ...rest, available })
      toast.success(`${item.name_en} is ${available ? 'back on' : 'off'} the menu`)
    } catch (e) {
      toast.error(describe(e))
      reload()
    }
  }

  async function moveItem(item: MenuItem, delta: number) {
    const siblings = (data?.items ?? []).filter((i) => i.category_id === item.category_id)
    const idx = siblings.findIndex((i) => i.id === item.id)
    const swap = siblings[idx + delta]
    if (!swap) return
    const ids = siblings.map((i) => i.id)
    ;[ids[idx], ids[idx + delta]] = [ids[idx + delta], ids[idx]]
    await api.post('/admin/items/reorder', { ids }).catch((e) => toast.error(describe(e)))
    reload()
  }

  async function moveCategory(cat: Category, delta: number) {
    const ids = cats.map((c) => c.id)
    const idx = ids.indexOf(cat.id)
    if (!ids[idx + delta]) return
    ;[ids[idx], ids[idx + delta]] = [ids[idx + delta], ids[idx]]
    await api.post('/admin/categories/reorder', { ids }).catch((e) => toast.error(describe(e)))
    reload()
  }

  const total = data?.items.length ?? 0
  const hidden = data?.items.filter((i) => !i.available).length ?? 0
  const noPhoto = data?.items.filter((i) => !i.image).length ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto text-sm text-muted-foreground">
          {total} dishes in {cats.length} categories
          {hidden > 0 && ` · ${hidden} hidden`}
          {noPhoto > 0 && ` · ${noPhoto} without a photo`}
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search dishes" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setCatDialog({ open: true, category: null })}><Plus /> Category</Button>
        <Button onClick={() => setItemSheet({ open: true, item: null, categoryId: cats[0]?.id })} disabled={!cats.length}><Plus /> Dish</Button>
      </div>

      {loading && !data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : cats.map((cat, ci) => {
        const list = items.filter((i) => i.category_id === cat.id)
        if (query && !list.length) return null
        return (
          <section key={cat.id} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-2xl">{cat.name_en} <span className="text-base text-muted-foreground">/ {cat.name_nl}</span></h2>
                {cat.note_en && <p className="text-sm text-muted-foreground">{cat.note_en}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setItemSheet({ open: true, item: null, categoryId: cat.id })}><Plus /> Dish</Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Category actions" />}><MoreHorizontal /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => setCatDialog({ open: true, category: cat })}><Pencil /> Rename</DropdownMenuItem>
                  <DropdownMenuItem disabled={ci === 0} onClick={() => moveCategory(cat, -1)}><ArrowUp /> Move up</DropdownMenuItem>
                  <DropdownMenuItem disabled={ci === cats.length - 1} onClick={() => moveCategory(cat, 1)}><ArrowDown /> Move down</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm({
                    title: `Delete “${cat.name_en}”?`,
                    body: 'Only empty categories can be deleted.',
                    run: async () => { await api.del(`/admin/categories/${cat.id}`); toast.success('Category deleted'); reload() },
                  })}><Trash2 /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {list.length === 0 ? (
              <Card className="items-center border-dashed py-8 text-sm text-muted-foreground">No dishes yet.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((item, ii) => (
                  <Card key={item.id} className={cn('gap-0 overflow-hidden py-0 transition-opacity', !item.available && 'opacity-60')}>
                    <button type="button" className="relative aspect-[4/3] bg-muted" onClick={() => setItemSheet({ open: true, item })}>
                      {item.image ? (
                        <img src={imageUrl(item.image)} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground"><ImageOff className="size-6" /></span>
                      )}
                      <span className="absolute top-2 left-2 flex gap-1">
                        {item.featured && <Badge className="bg-[#e8963a] text-[#1b2a49]"><Star className="fill-current" /> Chef’s pick</Badge>}
                        {item.badge && <Badge className="bg-primary text-primary-foreground">{BADGE_LABEL[item.badge]}</Badge>}
                        {item.tags.map((t) => <Badge key={t} className="bg-background/90 text-foreground">{t === 'vg' ? 'Vegan' : 'Vegetarian'}</Badge>)}
                        {!item.available && <Badge variant="destructive" className="bg-background/90">Hidden</Badge>}
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-heading text-lg leading-tight">{item.name_en}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.name_nl}</p>
                        </div>
                        <span className="font-medium tabular-nums">{euro(item.price)}</span>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{item.description_en}</p>
                      <div className="mt-auto flex items-center gap-2 pt-2">
                        <Switch checked={item.available} onCheckedChange={(v) => toggleAvailable(item, v)} aria-label="Available" />
                        <span className="text-xs text-muted-foreground">{item.available ? 'On the menu' : 'Hidden'}</span>
                        <div className="ml-auto flex">
                          <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={ii === 0 || !!query} onClick={() => moveItem(item, -1)}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={ii === list.length - 1 || !!query} onClick={() => moveItem(item, 1)}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setItemSheet({ open: true, item })}><Pencil /></Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <ItemSheet
        state={itemSheet}
        categories={cats}
        onOpenChange={(open) => setItemSheet((s) => ({ ...s, open }))}
        onSaved={reload}
        onDelete={(item) => setConfirm({
          title: `Delete “${item.name_en}”?`,
          body: 'It will be removed from the website menu. To take it off temporarily, switch it to hidden instead.',
          run: async () => { await api.del(`/admin/items/${item.id}`); toast.success('Dish deleted'); setItemSheet({ open: false }); reload() },
        })}
      />
      <CategoryDialog state={catDialog} onOpenChange={(open) => setCatDialog((s) => ({ ...s, open }))} onSaved={reload} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              try { await confirm?.run() } catch (e) { toast.error(describe(e)) }
              setConfirm(null)
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ItemSheet({ state, categories, onOpenChange, onSaved, onDelete }: {
  state: { open: boolean; item?: MenuItem | null; categoryId?: string }
  categories: Category[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onDelete: (item: MenuItem) => void
}) {
  const blank = (cid: string): ItemForm => ({
    category_id: cid, name_en: '', name_nl: '', description_en: '', description_nl: '', price: 0, tags: [], image: null, available: true,
    featured: false, badge: null,
  })
  const [form, setForm] = useState<ItemForm>(blank(''))
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state.open) return
    const f = state.item ? { ...state.item } : blank(state.categoryId ?? categories[0]?.id ?? '')
    setForm(f)
    setPrice(state.item ? (state.item.price / 100).toFixed(2).replace('.', ',') : '')
  }, [state.open, state.item, state.categoryId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const catItems = categories.map((c) => ({ value: c.id, label: c.name_en }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(price.replace(',', '.')) * 100)
    if (Number.isNaN(cents) || cents < 0) return toast.error('Enter a valid price, e.g. 12,50')
    setBusy(true)
    const body = { ...form, price: cents, name_nl: form.name_nl || form.name_en }
    try {
      if (state.item) await api.put(`/admin/items/${state.item.id}`, body)
      else await api.post('/admin/items', body)
      toast.success(state.item ? 'Dish saved' : 'Dish added')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={state.open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="flex min-h-full flex-col">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">{state.item ? 'Edit dish' : 'New dish'}</SheetTitle>
            <SheetDescription>Changes appear on the website straight away.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-5 px-4">
            <ImageUpload value={form.image} onChange={(url) => set('image', url)} />

            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select items={catItems} value={form.category_id} onValueChange={(v) => set('category_id', String(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{catItems.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="i-price">Price (€)</Label>
                <Input id="i-price" inputMode="decimal" placeholder="12,50" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>

            <Tabs defaultValue="en">
              <TabsList className="w-full">
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="nl">Nederlands</TabsTrigger>
              </TabsList>
              <TabsContent value="en" className="grid gap-3 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="i-name-en">Name</Label>
                  <Input id="i-name-en" required value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="i-desc-en">Description</Label>
                  <Textarea id="i-desc-en" rows={3} placeholder="Real ingredients, short sentences." value={form.description_en} onChange={(e) => set('description_en', e.target.value)} />
                </div>
              </TabsContent>
              <TabsContent value="nl" className="grid gap-3 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="i-name-nl">Naam</Label>
                  <Input id="i-name-nl" placeholder={form.name_en} value={form.name_nl} onChange={(e) => set('name_nl', e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="i-desc-nl">Omschrijving</Label>
                  <Textarea id="i-desc-nl" rows={3} value={form.description_nl} onChange={(e) => set('description_nl', e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid gap-3">
              <Label>Dietary</Label>
              <div className="flex gap-6">
                {TAGS.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.tags.includes(t.id)}
                      onCheckedChange={(c) => set('tags', c ? [...form.tags, t.id] : form.tags.filter((x) => x !== t.id))} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3">
              <span>
                <span className="flex items-center gap-2 text-sm font-medium"><Star className="size-4" /> Chef’s pick</span>
                <span className="text-xs text-muted-foreground">Shown first: on the homepage and at the top of the menu page.</span>
              </span>
              <Switch checked={form.featured} onCheckedChange={(v) => set('featured', v)} aria-label="Chef’s pick" />
              <div className="col-span-2 grid gap-2">
                <Label>Badge</Label>
                <Select items={BADGES} value={form.badge ?? 'none'} onValueChange={(v) => set('badge', v === 'none' ? null : (v as MenuItem['badge']))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{BADGES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use “Popular” only for dishes that really sell well; guests trust it.</p>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-lg border p-3">
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">{form.available ? <Eye className="size-4" /> : <EyeOff className="size-4" />} Show on the menu</span>
                <span className="text-xs text-muted-foreground">Turn off when it’s sold out or out of season.</span>
              </span>
              <Switch checked={form.available} onCheckedChange={(v) => set('available', v)} />
            </label>
          </div>

          <SheetFooter className="mt-auto flex-row justify-between gap-2">
            {state.item ? <Button type="button" variant="destructive" onClick={() => onDelete(state.item!)}><Trash2 /> Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save dish'}</Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function CategoryDialog({ state, onOpenChange, onSaved }: {
  state: { open: boolean; category?: Category | null }
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name_en: '', name_nl: '', note_en: '', note_nl: '' })
  useEffect(() => {
    if (state.open) {
      const c = state.category
      setForm({ name_en: c?.name_en ?? '', name_nl: c?.name_nl ?? '', note_en: c?.note_en ?? '', note_nl: c?.note_nl ?? '' })
    }
  }, [state.open, state.category])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = { ...form, name_nl: form.name_nl || form.name_en, note_en: form.note_en || null, note_nl: form.note_nl || null }
    try {
      if (state.category) await api.put(`/admin/categories/${state.category.id}`, body)
      else await api.post('/admin/categories', body)
      toast.success('Category saved')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(describe(err))
    }
  }

  const field = (key: keyof typeof form, label: string, required = false) => (
    <div className="grid gap-2">
      <Label htmlFor={`c-${key}`}>{label}</Label>
      <Input id={`c-${key}`} required={required} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  )

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{state.category ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogDescription>Shown as a tab on the website menu.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {field('name_en', 'Name (English)', true)}
            {field('name_nl', 'Naam (Nederlands)')}
            {field('note_en', 'Subtitle (English)')}
            {field('note_nl', 'Ondertitel (Nederlands)')}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
