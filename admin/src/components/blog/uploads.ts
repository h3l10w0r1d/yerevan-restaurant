import { toast } from 'sonner'
import { api, describe } from '@/lib/api'
import { prepare } from '@/components/image-upload'

/** Resize in the browser, upload, return the stored URL (or null on failure). */
export async function uploadImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) { toast.error('Choose an image file.'); return null }
  const id = toast.loading('Uploading image…')
  try {
    const { url } = await api.upload(await prepare(file))
    toast.success('Image uploaded', { id })
    return url
  } catch (e) {
    toast.error(describe(e), { id })
    return null
  }
}

export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
