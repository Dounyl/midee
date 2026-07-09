import { describe, expect, it } from 'vitest'
import { createMountHandle } from './mountComponent'

describe('createMountHandle', () => {
  it('allows unmount after the host subtree was removed', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const handle = createMountHandle(() => <div>summary</div>)
    handle.mount(host, undefined)

    host.remove()

    expect(() => handle.unmount()).not.toThrow()
  })
})
