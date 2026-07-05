import { cleanup } from '@solidjs/testing-library'
import { afterEach, vi } from 'vitest'

const fakeCanvasContext = {
  fillStyle: '#000000',
  globalCompositeOperation: 'source-over',
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
}

vi.stubGlobal('scrollTo', vi.fn())
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => fakeCanvasContext),
})

afterEach(cleanup)
