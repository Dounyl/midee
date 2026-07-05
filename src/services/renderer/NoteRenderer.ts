import { Container, Graphics, Text } from 'pixi.js'
import { GlowFilter } from 'pixi-filters'
import type { MidiKeySignature, MidiTrack } from '../core/midi/types'
import { pitchToJianpuLabel } from '../core/music/jianpu'
import { getTrackColor, type Theme } from './theme'
import { type Viewport, visibleNoteRange } from './viewport'

// One Graphics object per track — same-color draws are batched together.
// A separate glow container holds only the notes currently being struck,
// so the expensive GlowFilter only runs over a small subset each frame.

const PRACTICE_INACTIVE_ALPHA_SCALE = 0.24
const NOTE_LABEL_BOTTOM_INSET = 16

export class NoteRenderer {
  readonly container: Container

  private trackGraphics = new Map<string, Graphics>()
  private labelContainer: Container
  private labelPool: Text[] = []
  private glowContainer: Container
  private glowGraphics: Graphics
  private glowFilter: GlowFilter
  private keySignature: MidiKeySignature | null = null
  private labelsVisible = true

  constructor(private theme: Theme) {
    this.container = new Container()
    this.container.label = 'notes'
    this.labelContainer = new Container()
    this.labelContainer.label = 'note-labels'

    this.glowContainer = new Container()
    this.glowContainer.label = 'note-glow'

    this.glowFilter = new GlowFilter({
      distance: theme.noteGlowDistance,
      outerStrength: theme.noteGlowStrength,
      innerStrength: 0,
      color: 0xffffff,
      quality: 0.3,
    })
    this.glowContainer.filters = [this.glowFilter]

    this.glowGraphics = new Graphics()
    this.glowContainer.addChild(this.glowGraphics)
    this.container.addChild(this.labelContainer)
    this.container.addChild(this.glowContainer)
  }

  // Call once when tracks are loaded — sets up one Graphics per track
  setTracks(tracks: MidiTrack[]): void {
    // Remove stale graphics
    const incomingIds = new Set(tracks.map((t) => t.id))
    for (const [id, g] of this.trackGraphics) {
      if (!incomingIds.has(id)) {
        this.container.removeChild(g)
        g.destroy()
        this.trackGraphics.delete(id)
      }
    }

    for (const track of tracks) {
      if (!this.trackGraphics.has(track.id)) {
        const g = new Graphics()
        g.label = `notes-${track.id}`
        // Insert before the label layer so labels stay above note bodies and
        // below the expensive active-note glow.
        this.container.addChildAt(g, this.container.children.indexOf(this.labelContainer))
        this.trackGraphics.set(track.id, g)
      }
    }
  }

  // Called every frame from the main render loop.
  // Draws base notes and active-note glow in a single pass; accumulates the
  // glow-filter tint inline so no intermediate array is allocated per frame.
  draw(
    tracks: MidiTrack[],
    currentTime: number,
    viewport: Viewport,
    visibleTrackIds: Set<string>,
    practiceFocusTrackIds: ReadonlySet<string> | null,
  ): void {
    const { noteRadius } = this.theme
    const nowLineY = viewport.nowLineY
    this.glowGraphics.clear()
    this.resetLabelPool()

    let activeCount = 0
    let sumR = 0,
      sumG = 0,
      sumB = 0
    let labelIndex = 0

    const visStart = currentTime - viewport.trailSeconds - 0.5
    const visEnd = currentTime + viewport.lookaheadSeconds + 0.5

    for (const track of tracks) {
      const g = this.trackGraphics.get(track.id)
      if (!g) continue

      g.clear()

      if (!visibleTrackIds.has(track.id)) continue

      const noteColor = getTrackColor(track, this.theme)
      const practiceInactive =
        practiceFocusTrackIds !== null && !practiceFocusTrackIds.has(track.id)
      const colorR = (noteColor >> 16) & 0xff
      const colorG = (noteColor >> 8) & 0xff
      const colorB = noteColor & 0xff

      const [lo, hi] = visibleNoteRange(track.notes, visStart, visEnd)
      for (let ni = lo; ni < hi; ni++) {
        const note = track.notes[ni]!

        const x = viewport.pitchToX(note.pitch)
        const w = Math.max(viewport.pitchWidth(note.pitch) - 1, 2)
        const timeDelta = note.time - currentTime
        const noteBottom = Math.min(viewport.timeOffsetToY(timeDelta), nowLineY)
        const noteTop = viewport.timeOffsetToY(timeDelta + note.duration)
        if (noteTop >= nowLineY) continue
        const h = Math.max(noteBottom - noteTop, 3)
        const y = noteTop

        // Velocity → alpha (0.5 minimum so faint notes are still visible)
        const alpha =
          (0.5 + note.velocity * 0.5) * (practiceInactive ? PRACTICE_INACTIVE_ALPHA_SCALE : 1)

        g.roundRect(x, y, w, h, noteRadius)
        g.fill({ color: noteColor, alpha })
        labelIndex = this.drawNoteLabel(labelIndex, note.pitch, x, y, w, h, noteColor, alpha)

        if (
          !practiceInactive &&
          note.time <= currentTime &&
          note.time + note.duration >= currentTime
        ) {
          this.glowGraphics.roundRect(x, y, w, h, noteRadius)
          this.glowGraphics.fill({ color: noteColor, alpha: 0.9 })
          sumR += colorR
          sumG += colorG
          sumB += colorB
          activeCount++
        }
      }
    }

    if (activeCount > 0) {
      const avgColor =
        (Math.round(sumR / activeCount) << 16) |
        (Math.round(sumG / activeCount) << 8) |
        Math.round(sumB / activeCount)
      this.glowFilter.color = avgColor
      this.glowContainer.visible = true
    } else {
      this.glowContainer.visible = false
    }
  }

  private resetLabelPool(): void {
    for (const label of this.labelPool) label.visible = false
  }

  private drawNoteLabel(
    index: number,
    pitch: number,
    x: number,
    y: number,
    w: number,
    h: number,
    noteColor: number,
    alpha: number,
  ): number {
    if (!this.labelsVisible) return index
    if (w < 12 || h < 14) return index

    const text = this.labelAt(index)
    const fontSize = Math.max(10, Math.min(18, Math.min(w * 0.72, h * 0.42)))
    text.text = pitchToJianpuLabel(pitch, this.keySignature)
    text.style = {
      fontFamily: 'Inter, sans-serif',
      fontSize,
      fontWeight: '700',
      fill: 0xffffff,
      align: 'center',
      stroke: { color: noteColor, width: 3 },
    }
    text.x = x + w / 2
    // Keep labels visually anchored near the foot of the note so short and
    // long waterfalls share the same bottom spacing.
    text.y = y + h - NOTE_LABEL_BOTTOM_INSET
    text.alpha = Math.min(1, alpha + 0.18)
    text.visible = true
    return index + 1
  }

  private labelAt(index: number): Text {
    const existing = this.labelPool[index]
    if (existing) return existing

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        fontWeight: '700',
        fill: 0xffffff,
        align: 'center',
      },
    })
    label.anchor.set(0.5)
    this.labelPool.push(label)
    this.labelContainer.addChild(label)
    return label
  }

  updateTheme(theme: Theme): void {
    this.theme = theme
    this.glowFilter.distance = theme.noteGlowDistance
    this.glowFilter.outerStrength = theme.noteGlowStrength
  }

  setKeySignature(keySignature: MidiKeySignature | null): void {
    this.keySignature = keySignature
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible
  }

  clear(): void {
    this.trackGraphics.forEach((g) => {
      g.clear()
    })
    this.resetLabelPool()
    this.glowGraphics.clear()
    this.glowContainer.visible = false
  }
}
