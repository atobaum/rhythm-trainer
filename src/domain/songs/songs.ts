import type { TimeSignature } from '../rhythm/pattern.ts'

// 마디는 `|` 로 나누고 음은 `음높이/길이` 로 쓴다. 길이 1·2·4·8 은 온·2분·4분·8분음표, 뒤에 `.` 이면 점음표, `~` 이면 다음 음과 붙임줄. 쉼표는 `R`.
export type Song = {
  id: string
  title: string
  source: string
  key: string
  timeSignature: TimeSignature
  defaultBpm: number
  score: string
}

const FOUR_FOUR: TimeSignature = { numerator: 4, denominator: 4 }

export const SONGS: Song[] = [
  {
    id: 'song-twinkle',
    title: '작은 별',
    source: '프랑스 민요(18세기)',
    key: 'C장조',
    timeSignature: FOUR_FOUR,
    defaultBpm: 90,
    score: `
      C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2 |
      G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 |
      C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2
    `,
  },
  {
    id: 'song-mary-lamb',
    title: '메리의 작은 양',
    source: '미국 동요(1830)',
    key: 'C장조',
    timeSignature: FOUR_FOUR,
    defaultBpm: 100,
    score: `
      E4/4 D4/4 C4/4 D4/4 | E4/4 E4/4 E4/2 | D4/4 D4/4 D4/2 | E4/4 G4/4 G4/2 |
      E4/4 D4/4 C4/4 D4/4 | E4/4 E4/4 E4/4 E4/4 | D4/4 D4/4 E4/4 D4/4 | C4/1
    `,
  },
  {
    id: 'song-london-bridge',
    title: '런던 다리',
    source: '영국 동요',
    key: 'C장조',
    timeSignature: FOUR_FOUR,
    defaultBpm: 100,
    score: `
      G4/4. A4/8 G4/4 F4/4 | E4/4 F4/4 G4/2 | D4/4 E4/4 F4/2 | E4/4 F4/4 G4/2 |
      G4/4. A4/8 G4/4 F4/4 | E4/4 F4/4 G4/2 | D4/2 G4/2 | E4/4 C4/2.
    `,
  },
  {
    id: 'song-ode-to-joy',
    title: '환희의 송가',
    source: '베토벤 교향곡 9번(1824)',
    key: 'D장조',
    timeSignature: FOUR_FOUR,
    defaultBpm: 100,
    score: `
      F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | F#4/4. E4/8 E4/2 |
      F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | E4/4. D4/8 D4/2 |
      E4/4 E4/4 F#4/4 D4/4 | E4/4 F#4/8 G4/8 F#4/4 D4/4 | E4/4 F#4/8 G4/8 F#4/4 E4/4 | D4/4 E4/4 A3/2 |
      F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | E4/4. D4/8 D4/2
    `,
  },
  {
    id: 'song-jingle-bells',
    title: '징글벨 후렴',
    source: '제임스 로드 피어폰트(1857)',
    key: 'G장조',
    timeSignature: FOUR_FOUR,
    defaultBpm: 110,
    score: `
      B4/4 B4/4 B4/2 | B4/4 B4/4 B4/2 | B4/4 D5/4 G4/4. A4/8 | B4/1 |
      C5/4 C5/4 C5/4. C5/8 | C5/4 B4/4 B4/4 B4/8 B4/8 | B4/4 A4/4 A4/4 B4/4 | A4/2 D5/2 |
      B4/4 B4/4 B4/2 | B4/4 B4/4 B4/2 | B4/4 D5/4 G4/4. A4/8 | B4/1 |
      C5/4 C5/4 C5/4. C5/8 | C5/4 B4/4 B4/4 B4/8 B4/8 | D5/4 D5/4 C5/4 A4/4 | G4/1
    `,
  },
]
