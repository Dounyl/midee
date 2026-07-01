import { fireEvent, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { renderWithApp } from '../test/renderWithApp'
import { PlayMode } from './PlayMode'

describe('PlayMode', () => {
  it('renders the upload landing instead of forcing the picker when no MIDI is loaded', () => {
    const { ctx } = renderWithApp(() => <PlayMode />)
    expect(ctx.actions.library.open).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Open MIDI' })).toBeTruthy()
  })

  it('opens the play-targeted picker from the empty-state upload button', async () => {
    const { ctx } = renderWithApp(() => <PlayMode />)
    await fireEvent.click(screen.getByRole('button', { name: 'Open MIDI' }))
    expect(ctx.actions.library.open).toHaveBeenCalledWith({ kind: 'picker', target: 'play' })
  })
})
