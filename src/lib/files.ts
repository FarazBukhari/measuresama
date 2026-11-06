export function readFileAsText(file: Blob): Promise<string> {
  return file.text()
}

export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/** Load an image element from a File/Blob or URL. */
export function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = url
  })
}

/** Human readable byte size, e.g. 1.5 MB */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(decimals)} ${units[i]}`
}
