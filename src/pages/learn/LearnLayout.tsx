import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { t } from '../../i18n'
import './LearnLayout.css'

interface LearnLayoutProps {
  title?: string
  blurb?: string
  backToHub?: boolean
  variant?: 'default' | 'hub'
  children?: JSX.Element
}

export function LearnLayout(props: LearnLayoutProps) {
  const hasHeader = Boolean(props.backToHub || props.title || props.blurb)

  return (
    <section
      class="learn-route-page"
      classList={{ 'learn-route-page--hub': props.variant === 'hub' }}
    >
      {hasHeader ? (
        <header class="learn-route-page__header">
          {props.backToHub ? (
            <A class="learn-route-page__back" href="/learn">
              {t('learn.hub.back')}
            </A>
          ) : null}
          {props.title ? <h1 class="learn-route-page__title">{props.title}</h1> : null}
          {props.blurb ? <p class="learn-route-page__blurb">{props.blurb}</p> : null}
        </header>
      ) : null}
      <div
        class="learn-route-page__body"
        classList={{ 'learn-route-page__body--hub': props.variant === 'hub' }}
      >
        {props.children}
      </div>
    </section>
  )
}
