// Renders content/og.svg into dist/og.png (1200×630) using @resvg/resvg-js
// with the app's real fonts (Instrument Serif, Inter, JetBrains Mono) loaded
// from @fontsource packages. Runs during postbuild so the OG image is always
// fresh and in sync with whatever the SVG declares.

import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { decodeWoff } from './woff-font.mjs'

const root = process.cwd()
const svgPath = resolve(root, 'content/og.svg')
const pngOut = resolve(root, 'dist/og.png')
const svgOut = resolve(root, 'dist/og.svg')

const FS = resolve(root, 'node_modules/@fontsource')
const fontFiles = [
  `${FS}/instrument-serif/files/instrument-serif-latin-400-normal.woff`,
  `${FS}/instrument-serif/files/instrument-serif-latin-400-italic.woff`,
  `${FS}/inter/files/inter-latin-400-normal.woff`,
  `${FS}/inter/files/inter-latin-500-normal.woff`,
  `${FS}/inter/files/inter-latin-600-normal.woff`,
  `${FS}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff`,
]

const svg = readFileSync(svgPath, 'utf8')

// Native resvg silently drops text when passed the WOFF files directly.
// Decode our bundled fonts instead of depending on machine-specific fonts.
const tempDir = mkdtempSync(join(tmpdir(), 'midora-og-fonts-'))
const decodedFiles = []
try {
  for (const file of fontFiles) {
    const out = join(tempDir, `${basename(file, '.woff')}.ttf`)
    writeFileSync(out, decodeWoff(readFileSync(file)))
    decodedFiles.push(out)
  }
  const font = {
    fontFiles: decodedFiles,
    loadSystemFonts: false,
    defaultFontFamily: 'Inter',
  }
  // Fail the build if any brand font cannot produce visible text.
  for (const family of ['Inter', 'Instrument Serif', 'JetBrains Mono']) {
    const probe = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><text x="0" y="60" font-family="${family}" font-size="40">Midora</text></svg>`, { font })
    if (!probe.innerBBox()?.width) throw new Error(`OG font did not render: ${family}`)
  }
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font,
    background: '#05050a',
  })

  const pngBuffer = resvg.render().asPng()
  writeFileSync(pngOut, pngBuffer)
  writeFileSync(svgOut, svg)

  const kb = (pngBuffer.byteLength / 1024).toFixed(1)
  console.log(`[build-og] wrote dist/og.png (${kb} KB, 1200×630) + dist/og.svg`)
} finally {
  for (const file of decodedFiles) rmSync(file, { force: true })
  rmdirSync(tempDir)
}
