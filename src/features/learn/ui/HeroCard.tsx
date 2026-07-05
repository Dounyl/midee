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
  const className = (): string => {
    const base = cssModuleClass(styles, 'heroCard', props.interactive && 'interactive')
    return props.class ? `${base} ${props.class}` : base
  }

  return (
    <section
      class={className()}
      data-category={props.dataCategory}
      onClick={props.onClick}
    >
      {props.children}
    </section>
  )
}

export { styles as heroCardStyles }
