import { AppIntentDispatcher, type AppIntentDriver } from '@/app/runtime/AppIntentDispatcher'
import type { AppActions } from '@/stores/app/AppCtx'

export function createAppActions(driver: AppIntentDriver): AppActions {
  const dispatcher = new AppIntentDispatcher(driver)
  return {
    navigation: {
      toTarget: (target) => {
        dispatcher.dispatch({
          kind: 'navigation.navigate',
          target,
        })
      },
    },
    home: {
      enter: () => dispatcher.dispatch({ kind: 'route.home.enter' }),
    },
    play: {
      enter: (options) =>
        dispatcher.dispatch(
          options ? { kind: 'route.play.enter', options } : { kind: 'route.play.enter' },
        ),
    },
    live: {
      enter: () => dispatcher.dispatch({ kind: 'route.live.enter' }),
    },
    library: {
      open: (request) => dispatcher.dispatch({ kind: 'library.open', request }),
    },
    learn: {
      enterHub: (signal) =>
        Promise.resolve(
          dispatcher.dispatch(
            signal ? { kind: 'learn.hub.enter', signal } : { kind: 'learn.hub.enter' },
          ),
        ),
      exitHub: () => dispatcher.dispatch({ kind: 'learn.hub.exit' }),
      enterExercise: (route, signal) =>
        Promise.resolve(
          dispatcher.dispatch(
            signal
              ? { kind: 'learn.exercise.enter', routeId: route, signal }
              : { kind: 'learn.exercise.enter', routeId: route },
          ),
        ),
      exitExercise: () => dispatcher.dispatch({ kind: 'learn.exercise.exit' }),
      enter: (request) => dispatcher.dispatch({ kind: 'learn.request', request }),
    },
    session: {
      resetInteractionState: () => dispatcher.dispatch({ kind: 'session.resetInteraction' }),
      primeInteractiveAudio: () => dispatcher.dispatch({ kind: 'session.primeInteractiveAudio' }),
    },
  }
}
