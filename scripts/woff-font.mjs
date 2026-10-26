// Decode the bundled WOFF 1 fonts for resvg's native SFNT font loader.
// The font tables and their embedded attribution are preserved.
// Format: https://www.w3.org/TR/WOFF/
import { inflateSync } from 'node:zlib'

export function decodeWoff(font) {
  if (font.length < 44 || font.toString('ascii', 0, 4) !== 'wOFF') {
    throw new Error('Expected a WOFF 1 font')
  }
  const count = font.readUInt16BE(12)
  const size = font.readUInt32BE(16)
  if (!count || font.length < 44 + count * 20 || size < 12 + count * 16) {
    throw new Error('Invalid WOFF font directory')
  }

  const sfnt = Buffer.alloc(size)
  font.copy(sfnt, 0, 4, 8)
  const power = Math.floor(Math.log2(count))
  sfnt.writeUInt16BE(count, 4)
  sfnt.writeUInt16BE(16 * 2 ** power, 6)
  sfnt.writeUInt16BE(power, 8)
  sfnt.writeUInt16BE(count * 16 - 16 * 2 ** power, 10)

  let target = 12 + count * 16
  let headOffset
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20
    const offset = font.readUInt32BE(entry + 4)
    const compressedLength = font.readUInt32BE(entry + 8)
    const length = font.readUInt32BE(entry + 12)
    if (compressedLength > length || offset + compressedLength > font.length || target + length > size) {
      throw new Error('Invalid WOFF font table bounds')
    }
    const packed = font.subarray(offset, offset + compressedLength)
    const table = compressedLength < length ? inflateSync(packed, { maxOutputLength: length }) : packed
    if (table.length !== length) throw new Error('Invalid WOFF font table length')

    const directory = 12 + i * 16
    font.copy(sfnt, directory, entry, entry + 4)
    sfnt.writeUInt32BE(font.readUInt32BE(entry + 16), directory + 4)
    sfnt.writeUInt32BE(target, directory + 8)
    sfnt.writeUInt32BE(length, directory + 12)
    table.copy(sfnt, target)
    if (font.toString('ascii', entry, entry + 4) === 'head') {
      if (length < 12) throw new Error('Invalid font head table')
      headOffset = target
      sfnt.writeUInt32BE(0, target + 8)
    }
    target += Math.ceil(length / 4) * 4
  }
  if (target !== size || headOffset === undefined) throw new Error('Incomplete WOFF font')

  let checksum = 0
  for (let offset = 0; offset < size; offset += 4) checksum = (checksum + sfnt.readUInt32BE(offset)) >>> 0
  sfnt.writeUInt32BE((0xb1b0afba - checksum) >>> 0, headOffset + 8)
  return sfnt
}
