import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

const QUIET = 4

/** One path of unit squares, so the code stays crisp at any size and needs no canvas. */
export function qrPath(text: string): { path: string; size: number } {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  let path = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`
    }
  }
  return { path, size: n + QUIET * 2 }
}

/** Always dark-on-light with a quiet zone, whatever the theme: phone cameras need the contrast. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { path, size } = useMemo(() => qrPath(text), [text])
  return (
    <svg className="qr" role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
