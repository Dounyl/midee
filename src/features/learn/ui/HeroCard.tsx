import type { JSX } from 'solid-js'
import { cssModuleClass } from '../../ui/utils'
import styles from './HeroCard.module.css'

interface HeroCardProps {
  interactive?: boolean
  class?: string
  dataCategory?: string
  onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>
  children: JSX.Element
}

export function HeroCard(props: HeroCardProps) {
  const isInteractive = (): boolean => props.interactive || !!props.onClick
  const className = (): string => {
    const base = cssModuleClass(styles, 'heroCard', isInteractive() && 'interactive')
    return props.class ? `${base} ${props.class}` : base
  }
  if (isInteractive()) {
    return (
      <button
        type="button"
        class={className()}
        data-category={props.dataCategory}
        onClick={props.onClick}
      >
        {props.children}
      </button>
    )
  }

  return (
    <section class={className()} data-category={props.dataCategory}>
      {props.children}
    </section>
  )
}

export { styles as heroCardStyles }
