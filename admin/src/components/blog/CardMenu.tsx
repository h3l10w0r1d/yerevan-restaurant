import type { Editor } from '@tiptap/react'
import {
  Code2, Heading2, Heading3, Image as ImageIcon, List, ListOrdered, ListCollapse, Megaphone, MousePointerClick,
  Quote, SeparatorHorizontal, CirclePlay as Youtube,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { pickImage, uploadImage } from './uploads'

export type Range = { from: number; to: number }
type Item = { id: string; title: string; hint: string; icon: typeof ImageIcon; keywords?: string; run: (e: Editor) => void | 'url' }

export const CARDS: Item[] = [
  { id: 'image', title: 'Image', hint: 'Upload, or drop / paste an image', icon: ImageIcon, keywords: 'photo picture',
    run: (e) => { pickImage().then(async (f) => { const src = f && await uploadImage(f); if (src) e.chain().focus().insertContent({ type: 'imageCard', attrs: { src } }).run() }) } },
  { id: 'h2', title: 'Heading', hint: 'Section heading (H2)', icon: Heading2, keywords: 'title h2', run: (e) => { e.chain().focus().setNode('heading', { level: 2 }).run() } },
  { id: 'h3', title: 'Subheading', hint: 'Smaller heading (H3)', icon: Heading3, keywords: 'h3', run: (e) => { e.chain().focus().setNode('heading', { level: 3 }).run() } },
  { id: 'divider', title: 'Divider', hint: 'Insert a dividing line', icon: SeparatorHorizontal, keywords: 'hr line', run: (e) => { e.chain().focus().setHorizontalRule().run() } },
  { id: 'callout', title: 'Callout', hint: 'Info box that stands out', icon: Megaphone, keywords: 'note tip info',
    run: (e) => { e.chain().focus().insertContent({ type: 'callout', attrs: { emoji: '💡' } }).run() } },
  { id: 'toggle', title: 'Toggle', hint: 'Collapsible question and answer', icon: ListCollapse, keywords: 'faq accordion details',
    run: (e) => { e.chain().focus().insertContent({ type: 'toggleCard' }).run() } },
  { id: 'button', title: 'Button', hint: 'Call to action, e.g. Reserve a table', icon: MousePointerClick, keywords: 'cta link',
    run: (e) => { e.chain().focus().insertContent({ type: 'buttonCard' }).run() } },
  { id: 'youtube', title: 'YouTube', hint: 'Embed a video', icon: Youtube, keywords: 'video embed', run: () => 'url' },
  { id: 'quote', title: 'Quote', hint: 'Blockquote', icon: Quote, run: (e) => { e.chain().focus().toggleBlockquote().run() } },
  { id: 'bullet', title: 'Bulleted list', hint: 'Simple list', icon: List, keywords: 'ul', run: (e) => { e.chain().focus().toggleBulletList().run() } },
  { id: 'ordered', title: 'Numbered list', hint: 'Steps, ranking', icon: ListOrdered, keywords: 'ol steps', run: (e) => { e.chain().focus().toggleOrderedList().run() } },
  { id: 'code', title: 'Code', hint: 'Code block', icon: Code2, run: (e) => { e.chain().focus().toggleCodeBlock().run() } },
]

export function filterCards(query: string) {
  const q = query.trim().toLowerCase()
  return q ? CARDS.filter((c) => `${c.title} ${c.keywords ?? ''}`.toLowerCase().includes(q)) : CARDS
}

/** Ghost-style card menu: opened from the + button or by typing "/" on an empty line. */
export function CardMenu({ editor, query, range, active, onActive, onClose, style }: {
  editor: Editor
  query: string
  range: Range | null
  active: number
  onActive: (i: number) => void
  onClose: () => void
  style?: React.CSSProperties
}) {
  const items = filterCards(query)
  const [urlMode, setUrlMode] = useState(false)
  const [url, setUrl] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }) }, [active])

  const choose = (item: Item) => {
    if (range) editor.chain().focus().deleteRange(range).run()
    if (item.run(editor) === 'url') { setUrlMode(true); return }
    onClose()
  }

  if (urlMode) {
    return (
      <div className="gh-cardmenu gh-cardmenu--url" style={style}>
        <form onSubmit={(e) => {
          e.preventDefault()
          if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run()
          onClose()
        }}>
          <input autoFocus placeholder="Paste a YouTube link and press Enter" value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} />
        </form>
      </div>
    )
  }

  return (
    <div className="gh-cardmenu" style={style} ref={listRef} role="listbox" aria-label="Insert a card">
      <div className="gh-cardmenu__section">Primary</div>
      {items.length === 0 && <div className="gh-cardmenu__empty">No cards match “{query}”</div>}
      {items.map((item, i) => (
        <button key={item.id} type="button" role="option" aria-selected={i === active}
          className={cn('gh-cardmenu__item', i === active && 'is-active')}
          onMouseEnter={() => onActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}>
          <span className="gh-cardmenu__icon"><item.icon /></span>
          <span className="gh-cardmenu__text"><strong>{item.title}</strong><span>{item.hint}</span></span>
        </button>
      ))}
    </div>
  )
}

export function runCard(editor: Editor, query: string, index: number, range: Range | null): 'url' | void {
  const item = filterCards(query)[index]
  if (!item) return
  if (range) editor.chain().focus().deleteRange(range).run()
  return item.run(editor) === 'url' ? 'url' : undefined
}
