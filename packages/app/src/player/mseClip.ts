import { fetchRange, type PreviewClip } from '../yt/client'

/**
 * Plays the first bytes of a DASH fragmented MP4 in a <video> through MediaSource.
 * Returns a cleanup function. Resolves `onReady` once data is appended.
 */
export function playClip(video: HTMLVideoElement, clip: PreviewClip, onReady: () => void): () => void {
  if (!('MediaSource' in window) || !MediaSource.isTypeSupported(clip.mime)) return () => {}
  const ms = new MediaSource()
  const objectUrl = URL.createObjectURL(ms)
  let dead = false

  ms.addEventListener('sourceopen', async () => {
    try {
      const sb = ms.addSourceBuffer(clip.mime)
      const data = await fetchRange(clip.url, 0, clip.bytes - 1)
      if (dead) return
      sb.addEventListener('updateend', () => !dead && onReady(), { once: true })
      sb.appendBuffer(data)
    } catch {
      /* preview is optional: stay on the thumbnail */
    }
  }, { once: true })

  // Loop over whatever was buffered; a truncated tail fragment is simply never played.
  const onTime = () => {
    const b = video.buffered
    if (b.length && video.currentTime >= b.end(b.length - 1) - 0.4) video.currentTime = 0
  }
  video.addEventListener('timeupdate', onTime)
  video.src = objectUrl
  video.play().catch(() => {})

  return () => {
    dead = true
    video.removeEventListener('timeupdate', onTime)
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
