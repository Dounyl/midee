import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'

/**
 * Creates a { mount, unmount } handle that renders a Solid component into a
 * host HTMLElement. Replaces the pre-Solid-migration pattern of wrapping
 * every UI component in an ad-hoc imperative class with manual div creation,
 * render(), and dispose tracking.
 *
 * `setup` runs on the wrapper div before mounting — use it for positioning
 * styles, class names, etc. — and ensures no accidental style leakage between
 * call sites.
 */
export function createMountHandle<P>(
  component: (props: P) => JSX.Element,
  setup?: (div: HTMLDivElement) => void,
) {
  let dispose: (() => void) | null = null
  let wrapper: HTMLDivElement | null = null

  const reset = (): void => {
    const currentDispose = dispose
    const currentWrapper = wrapper
    dispose = null
    wrapper = null

    // If an ancestor already removed the mount root from the DOM, Solid's
    // disposer can walk sibling pointers that no longer exist. In that case
    // there's nothing left to detach from the document, so just drop refs.
    if (currentWrapper?.isConnected === false) return

    currentDispose?.()
    currentWrapper?.remove()
  }

  return {
    mount(host: HTMLElement, props: P): void {
      reset()
      const div = document.createElement('div')
      setup?.(div)
      host.appendChild(div)
      wrapper = div
      dispose = render(() => component(props), div)
    },
    unmount(): void {
      reset()
    },
  }
}
