import type { JSX } from 'solid-js'
import styles from './LearnLayout.module.css'

interface LearnLayoutProps {
  title?: string
  blurb?: string
  backToHub?: boolean
  variant?: 'default' | 'hub'
  children?: JSX.Element
}

export const learnLayoutStyles = styles

export function LearnLayout(props: LearnLayoutProps) {
  const hubPageClass = styles.learnRoutePageHub ?? ''
  const hubBodyClass = styles.learnRoutePageBodyHub ?? ''

  return (
    <section
      class={styles.learnRoutePage}
      classList={{
        [hubPageClass]: props.variant === 'hub',
        'learn-route-page--hub': props.variant === 'hub',
      }}
    >
      <div
        class={styles.learnRoutePageBody}
        classList={{ [hubBodyClass]: props.variant === 'hub' }}
      >
        {props.children}
      </div>
    </section>
  )
}
