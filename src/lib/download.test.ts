import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  isNative: false,
  platform: 'web',
  existing: new Set<string>(),
  writes: [] as { path: string; directory: string; data: string; recursive?: boolean }[],
  failDocuments: false,
  shares: [] as { files?: string[] }[],
  toasts: [] as { message: string; tone: string; options?: unknown }[],
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative, getPlatform: () => native.platform },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' },
  Filesystem: {
    // `existing` holds paths like "Measure Sama/photo.jpg"; the folder exists once it has a file.
    readdir: vi.fn(async ({ path }: { path: string }) => {
      if (path === '') return { files: native.existing.size ? [{ name: 'Measure Sama', type: 'directory' }] : [] }
      const inFolder = [...native.existing].filter((p) => p.startsWith(`${path}/`))
      return { files: inFolder.map((p) => ({ name: p.slice(path.length + 1), type: 'file' })) }
    }),
    writeFile: vi.fn(async (opts: { path: string; directory: string; data: string; recursive?: boolean }) => {
      if (opts.directory === 'DOCUMENTS' && native.failDocuments) throw new Error('Permission denied')
      native.writes.push(opts)
      return { uri: `file:///${opts.directory}/${opts.path}` }
    }),
  },
}))

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn(async (opts: { files?: string[] }) => void native.shares.push(opts)) },
}))

vi.mock('../state/toast', () => ({
  toast: (message: string, tone: string, options?: unknown) => native.toasts.push({ message, tone, options }),
}))

const { downloadBlob, downloadDataUrl, downloadText, numberedFileName, safeFileName } = await import('./download')

beforeEach(() => {
  native.isNative = false
  native.platform = 'web'
  native.existing.clear()
  native.writes = []
  native.failDocuments = false
  native.shares = []
  native.toasts = []
})

afterEach(() => vi.restoreAllMocks())

describe('file name helpers', () => {
  it('removes characters that are invalid in file names', () => {
    expect(safeFileName('my:photo/2024?.jpg')).toBe('my-photo-2024-.jpg')
    expect(safeFileName('  ..hidden  ')).toBe('hidden')
    expect(safeFileName('')).toBe('download')
  })

  it('numbers duplicate names before the extension', () => {
    expect(numberedFileName('photo.jpg', 2)).toBe('photo (2).jpg')
    expect(numberedFileName('README', 3)).toBe('README (3)')
    expect(numberedFileName('photo.jpg', 1)).toBe('photo.jpg')
  })
})

describe('downloadBlob in the browser', () => {
  it('clicks a download link with the file name', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const result = await downloadBlob(new Blob(['hi']), 'note.txt')
    expect(result).toEqual({ method: 'download' })
    const seen = click.mock.contexts[0] as HTMLAnchorElement
    expect(seen?.download).toBe('note.txt')
    expect(seen?.href).toBe('blob:fake')
    expect(native.writes).toHaveLength(0)
  })
})

describe('downloadBlob in the native app', () => {
  beforeEach(() => {
    native.isNative = true
    native.platform = 'android'
  })

  it('writes the file into Documents/Measure Sama as base64 and offers to share it', async () => {
    const result = await downloadText('hello', 'note.txt')
    expect(result).toMatchObject({ method: 'saved', path: 'Measure Sama/note.txt' })
    expect(native.writes).toEqual([{ path: 'Measure Sama/note.txt', directory: 'DOCUMENTS', data: btoa('hello'), recursive: true }])
    expect(native.toasts[0].message).toBe('Saved “note.txt” to Documents › Measure Sama')
    const action = (native.toasts[0].options as { action: { label: string; onClick: () => void } }).action
    expect(action.label).toBe('Share')
    action.onClick()
    await vi.waitFor(() => expect(native.shares).toEqual([expect.objectContaining({ files: ['file:///DOCUMENTS/Measure Sama/note.txt'] })]))
  })

  it('never overwrites an earlier download', async () => {
    native.existing.add('Measure Sama/photo.jpg')
    native.existing.add('Measure Sama/photo (2).jpg')
    const result = await downloadBlob(new Blob([new Uint8Array([1, 2, 3])]), 'photo.jpg')
    expect(result).toMatchObject({ path: 'Measure Sama/photo (3).jpg' })
    expect(native.writes[0].data).toBe(btoa(String.fromCharCode(1, 2, 3)))
  })

  it('falls back to the share sheet when Documents is not writable', async () => {
    native.failDocuments = true
    const result = await downloadBlob(new Blob(['x']), 'report.csv')
    expect(result).toEqual({ method: 'shared' })
    expect(native.writes[0]).toMatchObject({ directory: 'CACHE', path: 'share/report.csv' })
    expect(native.shares[0].files).toEqual(['file:///CACHE/share/report.csv'])
  })

  it('names the iPhone location in words people recognise', async () => {
    native.platform = 'ios'
    await downloadText('x', 'a.txt')
    expect(native.toasts[0].message).toBe('Saved “a.txt” to Files › On My iPhone › Measure Sama')
  })

  it('saves data: URLs (canvas exports) through the same path', async () => {
    const result = await downloadDataUrl('data:image/png;base64,iVBORw0KGgo=', 'qr.png')
    expect(result).toMatchObject({ method: 'saved', path: 'Measure Sama/qr.png' })
    expect(native.writes[0].data).toBe('iVBORw0KGgo=')
  })
})
