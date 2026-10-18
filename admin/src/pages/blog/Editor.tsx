import Youtube from '@tiptap/extension-youtube'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, type Editor as TEditor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Bold, ChevronLeft, Heading2, Heading3, ImagePlus, Italic, Link2, PanelRight, Plus, Quote } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CardMenu, filterCards, runCard, type Range } from '@/components/blog/CardMenu'
import { ButtonCard, CalloutCard, ImageCard, ToggleCard } from '@/components/blog/nodes'
import { PreviewModal, PublishFlow } from '@/components/blog/PublishFlow'
import { SettingsPanel } from '@/components/blog/SettingsPanel'
import { pickImage, uploadImage } from '@/components/blog/uploads'
import { api, describe, imageUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { BlogTag, Post, PostFields } from '@/lib/types'
import { cn } from '@/lib/utils'
import '@/components/blog/ghost.css'

// Where the public site lives (same origin in production; the dev site in development).
const SITE = (import.meta.env.VITE_SITE_ORIGIN as string | undefined) || window.location.origin
// The canonical public address for display (SERP previews, post URL).
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://www.yerevanrestaurant.nl'

const asUtc = (iso: string | null) => (iso && !/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? `${iso}Z` : iso)

const blank = (authorId: number | null): PostFields => ({
  title: '', slug: '', html: '', content_json: null, custom_excerpt: null, feature_image: null, feature_image_alt: null,
  feature_image_caption: null, featured: false, status: 'draft', published_at: null, language: 'nl', author_id: authorId,
  tag_ids: [], meta_title: null, meta_description: null, canonical_url: null, og_title: null, og_description: null,
  og_image: null, twitter_title: null, twitter_description: null, twitter_image: null, focus_keyword: null,
})

const pick = (p: Post): PostFields => ({
  ...blank(p.author_id), ...Object.fromEntries(Object.keys(blank(null)).map((k) => [k, p[k as keyof Post]])),
  tag_ids: p.tags.map((t) => t.id), published_at: asUtc(p.published_at),
} as PostFields)

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function PostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [postId, setPostId] = useState<number | null>(id && id !== 'new' ? Number(id) : null)
  const [uuid, setUuid] = useState('')
  const [fields, setFields] = useState<PostFields>(() => blank(user?.id ?? null))
  const [snapshot, setSnapshot] = useState('')
  const [loaded, setLoaded] = useState(!postId)
  const [save, setSave] = useState<SaveState>('idle')
  const [slugTouched, setSlugTouched] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [tags, setTags] = useState<BlogTag[]>([])
  const [authors, setAuthors] = useState<{ id: number; name: string }[]>([])
  const [plain, setPlain] = useState('')
  const [slash, setSlash] = useState<{ query: string; range: Range; top: number; left: number } | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const slashRef = useRef(slash)
  slashRef.current = slash
  const menuIndexRef = useRef(menuIndex)
  menuIndexRef.current = menuIndex

  const set = useCallback(<K extends keyof PostFields>(k: K, v: PostFields[K]) => {
    if (k === 'slug') setSlugTouched(true)
    setFields((f) => ({ ...f, [k]: v }))
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      Placeholder.configure({ placeholder: 'Begin writing your post…' }),
      Youtube.configure({ nocookie: true, HTMLAttributes: { class: 'kg-embed-iframe' } }),
      ImageCard, CalloutCard, ButtonCard, ToggleCard,
    ],
    content: '',
    editorProps: {
      attributes: { class: 'gh-content' },
      handleKeyDown: (_view, event) => {
        const s = slashRef.current
        if (!s) return false
        const count = filterCards(s.query).length
        if (event.key === 'ArrowDown') { setMenuIndex((i) => (i + 1) % Math.max(1, count)); return true }
        if (event.key === 'ArrowUp') { setMenuIndex((i) => (i - 1 + count) % Math.max(1, count)); return true }
        if (event.key === 'Escape') { setSlash(null); return true }
        if (event.key === 'Enter' && count) {
          event.preventDefault()
          const r = runCard(editorRef.current!, s.query, menuIndexRef.current, s.range)
          setSlash(null)
          if (r === 'url') setPlusOpen(true)
          return true
        }
        return false
      },
      handlePaste: (_view, event) => insertFiles([...(event.clipboardData?.files ?? [])]),
      handleDrop: (_view, event) => insertFiles([...((event as DragEvent).dataTransfer?.files ?? [])]),
    },
    onUpdate: ({ editor: e }) => {
      setFields((f) => ({ ...f, html: e.getHTML(), content_json: e.getJSON() }))
      setPlain(e.getText({ blockSeparator: '\n' }))
      detectSlash(e)
    },
    onSelectionUpdate: ({ editor: e }) => detectSlash(e),
  })
  const editorRef = useRef<TEditor | null>(null)
  editorRef.current = editor

  function insertFiles(files: File[]): boolean {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length || !editorRef.current) return false
    images.forEach(async (f) => {
      const src = await uploadImage(f)
      if (src) editorRef.current?.chain().focus().insertContent({ type: 'imageCard', attrs: { src } }).run()
    })
    return true
  }

  // "/" at the start of an empty paragraph opens the card menu, filtered by what follows.
  function detectSlash(e: TEditor) {
    const { $from, empty } = e.state.selection
    const text = $from.parent.textContent
    if (empty && $from.parent.type.name === 'paragraph' && text.startsWith('/') && !text.includes(' ') && $from.parentOffset === text.length) {
      const start = $from.start()
      const coords = e.view.coordsAtPos(start)
      const box = wrapRef.current?.getBoundingClientRect()
      setSlash({ query: text.slice(1), range: { from: start, to: start + text.length }, top: coords.bottom - (box?.top ?? 0) + 8, left: coords.left - (box?.left ?? 0) })
      setMenuIndex(0)
    } else if (slashRef.current) {
      setSlash(null)
    }
  }

  // Load the post, tags and authors.
  useEffect(() => {
    api.get<BlogTag[]>('/admin/tags').then(setTags).catch(() => {})
    api.get<{ id: number; name: string }[]>('/admin/authors').then(setAuthors).catch(() => {})
  }, [])
  useEffect(() => {
    if (!postId || !editor || loaded) return
    api.get<Post>(`/admin/posts/${postId}`).then((p) => {
      // React StrictMode may have replaced the editor while the request was in flight.
      const editor = editorRef.current
      if (!editor || editor.isDestroyed) return
      editor.commands.setContent(p.content_json ?? p.html, { emitUpdate: false })
      const f = { ...pick(p), html: editor.getHTML(), content_json: editor.getJSON() }
      setFields(f)
      setUuid(p.uuid)
      setSlugTouched(true)
      setPlain(editor.getText({ blockSeparator: '\n' }))
      setSnapshot(JSON.stringify(f))
      setLoaded(true)
    }).catch((e) => { toast.error(describe(e)); navigate('/posts') })
  }, [postId, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded && !postId) setTimeout(() => titleRef.current?.focus(), 50)
  }, [loaded, postId])

  useEffect(() => {
    const t = titleRef.current
    if (t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px` }
  }, [fields.title, loaded, settingsOpen])

  const dirty = loaded && JSON.stringify(fields) !== snapshot
  const isPublished = fields.status === 'published'
  const isScheduled = isPublished && !!fields.published_at && new Date(fields.published_at) > new Date()
  const hasContent = !!(fields.title.trim() || plain.trim() || fields.feature_image)

  const persist = useCallback(async (override?: Partial<PostFields>) => {
    const body = { ...fields, ...override, slug: slugTouched || fields.status === 'published' ? fields.slug : '' }
    setSave('saving')
    try {
      const p = postId ? await api.put<Post>(`/admin/posts/${postId}`, body) : await api.post<Post>('/admin/posts', body)
      const next = { ...body, ...override, slug: p.slug, status: p.status, published_at: asUtc(p.published_at) }
      setFields((f) => ({ ...f, ...override, slug: p.slug, status: p.status, published_at: asUtc(p.published_at) }))
      setSnapshot(JSON.stringify(next))
      setUuid(p.uuid)
      if (!postId) { setPostId(p.id); navigate(`/posts/${p.id}`, { replace: true }) }
      setSave('saved')
      return true
    } catch (e) {
      setSave('error')
      toast.error(describe(e))
      return false
    }
  }, [fields, postId, slugTouched, navigate])

  // Drafts save themselves, like in Ghost. Published posts wait for "Update".
  useEffect(() => {
    if (!dirty || isPublished || !hasContent || save === 'saving') return
    const t = setTimeout(() => { persist() }, 1800)
    return () => clearTimeout(t)
  }, [fields, dirty, isPublished, hasContent]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); persist() }
    }
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault() } }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload) }
  }, [persist, dirty])

  const words = useMemo(() => (plain.trim() ? plain.trim().split(/\s+/).length : 0), [plain])
  const status = isScheduled ? 'Scheduled' : isPublished ? 'Published' : 'Draft'
  const saveText = save === 'saving' ? 'Saving…' : save === 'error' ? 'Not saved' : dirty && isPublished ? 'Unsaved changes' : save === 'saved' || postId ? 'Saved' : 'New'

  const back = () => {
    if (dirty && isPublished && !window.confirm('You have unsaved changes. Leave without updating?')) return
    if (dirty && !isPublished && hasContent) persist()
    navigate('/posts')
  }

  const publish = async (at: Date | null) => persist({ status: 'published', published_at: at ? at.toISOString() : new Date().toISOString() })
  const unpublish = async () => {
    if (!window.confirm(isScheduled ? 'Unschedule this post? It goes back to draft.' : 'Unpublish this post? It will disappear from the website.')) return
    if (await persist({ status: 'draft', published_at: null })) toast.success(isScheduled ? 'Post unscheduled' : 'Post unpublished')
  }
  const remove = async () => {
    if (!window.confirm('Delete this post permanently?')) return
    if (postId) await api.del(`/admin/posts/${postId}`).catch((e) => toast.error(describe(e)))
    toast.success('Post deleted')
    navigate('/posts')
  }
  const openPreview = async () => {
    if (!postId || dirty) { if (!(await persist())) return }
    setPreviewing(true)
  }
  const addFeature = async () => {
    const f = await pickImage()
    const url = f && await uploadImage(f)
    if (url) set('feature_image', url)
  }
  const createTag = async (name: string) => {
    try {
      const t = await api.post<BlogTag>('/admin/tags', { name })
      setTags((list) => [...list, t])
      return t
    } catch (e) { toast.error(describe(e)); return null }
  }

  return (
    <div className={cn('gh', settingsOpen && 'gh--psm')}>
      {!loaded && <div className="gh-editor-loading">Loading…</div>}
      <header className="gh-editor-bar">
        <div className="gh-editor-bar__left">
          <button type="button" className="gh-back" onClick={back}><ChevronLeft /> Posts</button>
          <span className="gh-status"><span className={cn('gh-status__label', `is-${status.toLowerCase()}`)}>{status}</span> · {saveText}</span>
        </div>
        <div className="gh-editor-bar__right">
          {isPublished && <button type="button" className="gh-link" onClick={unpublish}>{isScheduled ? 'Unschedule' : 'Unpublish'}</button>}
          <button type="button" className="gh-link" onClick={openPreview} disabled={!hasContent}>Preview</button>
          {isPublished
            ? <button type="button" className="gh-link gh-link--green" onClick={() => persist().then((ok) => ok && toast.success('Post updated'))} disabled={!dirty || save === 'saving'}>Update</button>
            : <button type="button" className="gh-link gh-link--green" onClick={() => setPublishing(true)} disabled={!fields.title.trim()}>Publish</button>}
          <button type="button" className={cn('gh-icon-btn', settingsOpen && 'is-active')} onClick={() => setSettingsOpen((o) => !o)} aria-label="Post settings"><PanelRight /></button>
        </div>
      </header>

      <main className="gh-editor">
        <div className="gh-feature">
          {fields.feature_image ? (
            <figure className="gh-feature__image">
              <img src={imageUrl(fields.feature_image)} alt="" />
              <button type="button" className="gh-feature__remove" onClick={() => set('feature_image', null)}>Remove</button>
              <input className="gh-caption" placeholder="Add a caption to the feature image" value={fields.feature_image_caption ?? ''} onChange={(e) => set('feature_image_caption', e.target.value)} />
              <input className="gh-alt" placeholder="Alt text: describe the image (important for SEO)" value={fields.feature_image_alt ?? ''} onChange={(e) => set('feature_image_alt', e.target.value)} />
            </figure>
          ) : (
            <button type="button" className="gh-feature__add" onClick={addFeature}><ImagePlus /> Add feature image</button>
          )}
        </div>

        <textarea
          ref={titleRef}
          className="gh-title"
          placeholder="Post title"
          rows={1}
          value={fields.title}
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start') } }}
        />

        <div className="gh-body" ref={wrapRef}>
          {editor && (
            <>
              <FloatingMenu editor={editor} options={{ placement: 'left-start', offset: 14 }}
                shouldShow={({ state }) => {
                  const { $from, empty } = state.selection
                  return empty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
                }}>
                <button type="button" className="gh-plus" aria-label="Add a card" onClick={() => { setPlusOpen((o) => !o); setMenuIndex(0) }}><Plus /></button>
                {plusOpen && (
                  <CardMenu editor={editor} query="" range={null} active={menuIndex} onActive={setMenuIndex}
                    onClose={() => setPlusOpen(false)} style={{ position: 'absolute', top: 36, left: 0 }} />
                )}
              </FloatingMenu>

              <BubbleMenu editor={editor} options={{ placement: 'top' }}
                shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive('imageCard') && !e.isActive('buttonCard') && !e.isActive('toggleCard')}>
                <div className="gh-toolbar">
                  {linkMode ? (
                    <form onSubmit={(ev) => {
                      ev.preventDefault()
                      if (linkUrl) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
                      else editor.chain().focus().unsetLink().run()
                      setLinkMode(false)
                    }}>
                      <input autoFocus placeholder="Paste a link, or /menu" value={linkUrl} onChange={(ev) => setLinkUrl(ev.target.value)}
                        onKeyDown={(ev) => { if (ev.key === 'Escape') setLinkMode(false) }} />
                    </form>
                  ) : (
                    <>
                      <button type="button" className={cn(editor.isActive('bold') && 'is-active')} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold /></button>
                      <button type="button" className={cn(editor.isActive('italic') && 'is-active')} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic /></button>
                      <span className="gh-toolbar__sep" />
                      <button type="button" className={cn(editor.isActive('heading', { level: 2 }) && 'is-active')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading"><Heading2 /></button>
                      <button type="button" className={cn(editor.isActive('heading', { level: 3 }) && 'is-active')} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Subheading"><Heading3 /></button>
                      <button type="button" className={cn(editor.isActive('blockquote') && 'is-active')} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote"><Quote /></button>
                      <span className="gh-toolbar__sep" />
                      <button type="button" className={cn(editor.isActive('link') && 'is-active')} onClick={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setLinkMode(true) }} aria-label="Link"><Link2 /></button>
                    </>
                  )}
                </div>
              </BubbleMenu>
            </>
          )}
          <EditorContent editor={editor} />
          {slash && editor && (
            <CardMenu editor={editor} query={slash.query} range={slash.range} active={menuIndex} onActive={setMenuIndex}
              onClose={() => setSlash(null)} style={{ position: 'absolute', top: slash.top, left: slash.left }} />
          )}
        </div>
      </main>

      <div className="gh-wordcount">{words} {words === 1 ? 'word' : 'words'}</div>

      {settingsOpen && (
        <SettingsPanel post={fields} set={set} tags={tags} createTag={createTag} authors={authors} plain={plain}
          siteUrl={PUBLIC_URL} onDelete={remove} onClose={() => setSettingsOpen(false)} />
      )}
      {publishing && (
        <PublishFlow title={fields.title} excerpt={fields.custom_excerpt || plain.slice(0, 160)} featureImage={fields.feature_image}
          postUrl={`${PUBLIC_URL}/blog/${fields.slug}`} onPublish={publish} onClose={() => setPublishing(false)} onDone={() => setPublishing(false)} />
      )}
      {previewing && uuid && <PreviewModal url={`${SITE}/blog/p/${uuid}`} onClose={() => setPreviewing(false)} />}
    </div>
  )
}
