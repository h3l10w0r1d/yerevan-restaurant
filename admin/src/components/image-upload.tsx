import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, describe, imageUrl } from '@/lib/api'

const MAX_SIDE = 1600

/** Downscale in the browser and re-encode as WebP (JPEG where WebP encoding isn't available). */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const encode = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.82))
  const webp = await encode('image/webp')
  if (webp && webp.type === 'image/webp') return webp
  return (await encode('image/jpeg'))!
}

export function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  async function handle(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file.')
    setBusy(true)
    try {
      const blob = await prepare(file)
      const { url } = await api.upload(blob)
      onChange(url)
      toast.success(`Photo uploaded (${Math.round(blob.size / 1024)} KB)`)
    } catch (e) {
      toast.error(describe(e))
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    handle(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn('relative aspect-[4/3] overflow-hidden rounded-lg border-2 border-dashed bg-muted/40 transition-colors',
          drag && 'border-primary bg-primary/5')}
      >
        {value ? (
          <img src={imageUrl(value)} alt="" className="size-full object-cover" />
        ) : (
          <button type="button" onClick={() => input.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ImagePlus className="size-8" />
            <span>Drop a photo here or click to upload</span>
            <span className="text-xs">Shown at 4:3 on the website. Large photos are resized automatically.</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          <Upload /> {value ? 'Replace photo' : 'Upload photo'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy}>
            <Trash2 /> Remove
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
