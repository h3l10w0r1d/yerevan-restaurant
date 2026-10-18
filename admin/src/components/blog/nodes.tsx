import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { AlignCenter, AlignLeft, Maximize2, Minimize2, MoveHorizontal, Trash2 } from 'lucide-react'
import { imageUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

/* Cards produce the same HTML the public blog styles (kg-* classes, as in Ghost). */

// --- Image card -----------------------------------------------------------

type Width = 'regular' | 'wide' | 'full'

function ImageView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const { src, alt, caption, width } = node.attrs as { src: string; alt: string; caption: string; width: Width }
  const widths: { w: Width; icon: typeof Minimize2; label: string }[] = [
    { w: 'regular', icon: Minimize2, label: 'Regular' },
    { w: 'wide', icon: MoveHorizontal, label: 'Wide' },
    { w: 'full', icon: Maximize2, label: 'Full width' },
  ]
  return (
    <NodeViewWrapper className={cn('gh-card gh-image', `gh-width-${width}`, selected && 'gh-card--selected')} data-drag-handle>
      {selected && (
        <div className="gh-card-toolbar" contentEditable={false}>
          {widths.map(({ w, icon: Icon, label }) => (
            <button key={w} type="button" title={label} className={cn(width === w && 'is-active')} onClick={() => updateAttributes({ width: w })}><Icon /></button>
          ))}
          <span className="gh-card-toolbar__sep" />
          <button type="button" title="Delete" onClick={deleteNode}><Trash2 /></button>
        </div>
      )}
      <img src={imageUrl(src)} alt={alt} draggable={false} />
      <div className="gh-image-fields" contentEditable={false}>
        <input className="gh-caption" placeholder="Type caption for image (optional)" value={caption ?? ''}
          onChange={(e) => updateAttributes({ caption: e.target.value })} />
        {selected && (
          <input className="gh-alt" placeholder="Alt text: describe the image for search engines and screen readers" value={alt ?? ''}
            onChange={(e) => updateAttributes({ alt: e.target.value })} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ImageCard = Node.create({
  name: 'imageCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: 'regular' },
    }
  },
  parseHTML() {
    return [{
      tag: 'figure.kg-image-card',
      getAttrs: (el) => {
        const e = el as HTMLElement
        const img = e.querySelector('img')
        const cls = e.className
        return {
          src: img?.getAttribute('src') ?? '', alt: img?.getAttribute('alt') ?? '',
          caption: e.querySelector('figcaption')?.textContent ?? '',
          width: cls.includes('kg-width-full') ? 'full' : cls.includes('kg-width-wide') ? 'wide' : 'regular',
        }
      },
    }]
  },
  renderHTML({ node }) {
    const { src, alt, caption, width } = node.attrs
    const cls = `kg-card kg-image-card${width !== 'regular' ? ` kg-width-${width}` : ''}`
    const img = ['img', { src, alt, loading: 'lazy' }]
    return caption ? ['figure', { class: cls }, img, ['figcaption', {}, caption]] : ['figure', { class: cls }, img]
  },
  addNodeView() { return ReactNodeViewRenderer(ImageView) },
})

// --- Callout card -----------------------------------------------------------

const EMOJIS = ['💡', '🍷', '🔥', '📍', '🗓️', '⭐', '❗', '🌿']

function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="gh-card gh-callout">
      <select contentEditable={false} className="gh-callout-emoji" value={node.attrs.emoji}
        onChange={(e) => updateAttributes({ emoji: e.target.value })} aria-label="Callout emoji">
        {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      <NodeViewContent className="gh-callout-text" />
    </NodeViewWrapper>
  )
}

export const CalloutCard = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() { return { emoji: { default: '💡' } } },
  parseHTML() {
    return [{
      tag: 'div.kg-callout-card',
      contentElement: '.kg-callout-text',
      getAttrs: (el) => ({ emoji: (el as HTMLElement).getAttribute('data-emoji') || '💡' }),
    }]
  },
  renderHTML({ node }) {
    return ['div', { class: 'kg-card kg-callout-card', 'data-emoji': node.attrs.emoji },
      ['div', { class: 'kg-callout-emoji' }, node.attrs.emoji], ['div', { class: 'kg-callout-text' }, 0]]
  },
  addNodeView() { return ReactNodeViewRenderer(CalloutView) },
})

// --- Button card ------------------------------------------------------------

function ButtonView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const { text, url, align } = node.attrs
  return (
    <NodeViewWrapper className={cn('gh-card gh-button', `gh-align-${align}`, selected && 'gh-card--selected')}>
      <span className="gh-btn-preview">{text || 'Button text'}</span>
      {selected && (
        <div className="gh-card-settings" contentEditable={false}>
          <input placeholder="Button text" value={text} onChange={(e) => updateAttributes({ text: e.target.value })} />
          <input placeholder="https://… or /menu" value={url} onChange={(e) => updateAttributes({ url: e.target.value })} />
          <div className="gh-seg">
            <button type="button" className={cn(align === 'left' && 'is-active')} onClick={() => updateAttributes({ align: 'left' })}><AlignLeft /></button>
            <button type="button" className={cn(align === 'center' && 'is-active')} onClick={() => updateAttributes({ align: 'center' })}><AlignCenter /></button>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const ButtonCard = Node.create({
  name: 'buttonCard',
  group: 'block',
  atom: true,
  addAttributes() { return { text: { default: 'Reserve a table' }, url: { default: '/#reserve' }, align: { default: 'center' } } },
  parseHTML() {
    return [{
      tag: 'div.kg-button-card',
      getAttrs: (el) => {
        const a = (el as HTMLElement).querySelector('a')
        return { text: a?.textContent ?? '', url: a?.getAttribute('href') ?? '', align: (el as HTMLElement).className.includes('kg-align-left') ? 'left' : 'center' }
      },
    }]
  },
  renderHTML({ node }) {
    return ['div', { class: `kg-card kg-button-card kg-align-${node.attrs.align}` }, ['a', { href: node.attrs.url, class: 'kg-btn' }, node.attrs.text]]
  },
  addNodeView() { return ReactNodeViewRenderer(ButtonView) },
})

// --- Toggle card ------------------------------------------------------------

function ToggleView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="gh-card gh-toggle">
      <input className="gh-toggle-heading" placeholder="Toggle header" value={node.attrs.heading} contentEditable={false}
        onChange={(e) => updateAttributes({ heading: e.target.value })} />
      <textarea className="gh-toggle-body" placeholder="Collapsible content" rows={2} value={node.attrs.body} contentEditable={false}
        onChange={(e) => updateAttributes({ body: e.target.value })} />
    </NodeViewWrapper>
  )
}

export const ToggleCard = Node.create({
  name: 'toggleCard',
  group: 'block',
  atom: true,
  addAttributes() { return { heading: { default: '' }, body: { default: '' } } },
  parseHTML() {
    return [{
      tag: 'details.kg-toggle-card',
      getAttrs: (el) => {
        const e = el as HTMLElement
        return {
          heading: e.querySelector('summary')?.textContent ?? '',
          body: [...e.querySelectorAll('.kg-toggle-content p')].map((p) => p.textContent).join('\n'),
        }
      },
    }]
  },
  renderHTML({ node }) {
    const paras = String(node.attrs.body || '').split(/\n+/).filter(Boolean).map((t) => ['p', {}, t])
    return ['details', mergeAttributes({ class: 'kg-card kg-toggle-card' }),
      ['summary', {}, node.attrs.heading || ' '], ['div', { class: 'kg-toggle-content' }, ...(paras.length ? paras : [['p', {}, ' ']])]]
  },
  addNodeView() { return ReactNodeViewRenderer(ToggleView) },
})
