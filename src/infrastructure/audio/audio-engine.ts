import type { ScheduledSound, SoundKind } from '../../application/practice-types.ts'

type Voice = {
  frequency: number
  endFrequency: number
  type: OscillatorType
  gain: number
  lengthSec: number
}

// 기준음은 작고 높은 틱, 패턴 음은 크고 낮게 떨어지는 타악기 소리로 둬서 듣고 치기에서 둘을 구별하게 한다.
const VOICES: Record<SoundKind, Voice> = {
  accent: { frequency: 2400, endFrequency: 2400, type: 'sine', gain: 0.22, lengthSec: 0.03 },
  beat: { frequency: 1800, endFrequency: 1800, type: 'sine', gain: 0.1, lengthSec: 0.025 },
  note: { frequency: 220, endFrequency: 110, type: 'triangle', gain: 0.9, lengthSec: 0.18 },
  'note-high': { frequency: 520, endFrequency: 300, type: 'triangle', gain: 0.8, lengthSec: 0.15 },
  'strum-down': { frequency: 180, endFrequency: 90, type: 'sawtooth', gain: 0.35, lengthSec: 0.2 },
  'strum-up': { frequency: 420, endFrequency: 260, type: 'sawtooth', gain: 0.22, lengthSec: 0.12 },
  tap: { frequency: 700, endFrequency: 420, type: 'square', gain: 0.3, lengthSec: 0.07 },
}

const SCHEDULE_LEAD_SEC = 0.3
const STRESSED_GAIN = 1.8

export class AudioEngine {
  private context: AudioContext | null = null
  private sessionOutput: GainNode | null = null
  private sessionStartTime = 0

  private getContext(): AudioContext {
    this.context ??= new AudioContext({ latencyHint: 'interactive' })
    return this.context
  }

  async unlock(): Promise<void> {
    const context = this.getContext()
    if (context.state !== 'running') {
      await context.resume()
    }
  }

  playSession(sounds: ScheduledSound[]): number {
    const context = this.getContext()
    this.stop()
    const output = context.createGain()
    output.connect(context.destination)
    this.sessionOutput = output

    const startTime = context.currentTime + SCHEDULE_LEAD_SEC
    this.sessionStartTime = startTime
    this.appendToSession(sounds)
    return startTime
  }

  appendToSession(sounds: ScheduledSound[]): void {
    const output = this.sessionOutput
    if (!output) {
      return
    }
    for (const sound of sounds) {
      this.scheduleVoice(output, sound.kind, this.sessionStartTime + sound.timeMs / 1000, sound.stressed === true)
    }
  }

  sessionElapsedMs(): number {
    return (this.getContext().currentTime - this.sessionStartTime) * 1000
  }

  stop(): void {
    this.sessionOutput?.disconnect()
    this.sessionOutput = null
  }

  stopSessionStartedAt(startTime: number): void {
    if (this.sessionOutput !== null && this.sessionStartTime === startTime) {
      this.stop()
    }
  }

  audioTimeToPerformanceMs(audioTime: number): number {
    const context = this.getContext()
    const stamp = context.getOutputTimestamp?.()
    if (stamp && stamp.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
      return stamp.performanceTime + (audioTime - stamp.contextTime) * 1000
    }
    const outputLatencySec = context.outputLatency || context.baseLatency || 0
    return performance.now() + (audioTime - context.currentTime + outputLatencySec) * 1000
  }

  private scheduleVoice(output: AudioNode, kind: SoundKind, time: number, stressed: boolean): void {
    const context = this.getContext()
    const voice = VOICES[kind]
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = voice.type
    oscillator.frequency.setValueAtTime(voice.frequency, time)
    if (voice.endFrequency !== voice.frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, time + voice.lengthSec)
    }
    envelope.gain.setValueAtTime(Math.min(1, voice.gain * (stressed ? STRESSED_GAIN : 1)), time)
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + voice.lengthSec)
    oscillator.connect(envelope)
    envelope.connect(output)
    oscillator.start(time)
    oscillator.stop(time + voice.lengthSec + 0.01)
  }
}

export const audioEngine = new AudioEngine()
