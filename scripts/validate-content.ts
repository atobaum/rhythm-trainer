import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePattern } from '../src/domain/rhythm/pattern.ts'

const patternDirectory = join(import.meta.dirname, '..', 'src', 'content', 'patterns')
const files = readdirSync(patternDirectory).filter((file) => file.endsWith('.json'))

const failures: string[] = []
const patternIds = new Map<string, string>()

for (const file of files) {
  try {
    const pattern = parsePattern(JSON.parse(readFileSync(join(patternDirectory, file), 'utf8')))
    const duplicateFile = patternIds.get(pattern.id)
    if (duplicateFile) {
      failures.push(`${file}: 패턴 id ${pattern.id} 가 ${duplicateFile} 와 중복됩니다`)
    }
    patternIds.set(pattern.id, file)
  } catch (error) {
    failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length > 0) {
  console.error(`콘텐츠 검사 실패 (${failures.length}/${files.length})\n\n${failures.join('\n\n')}`)
  process.exit(1)
}

console.log(`콘텐츠 검사 통과: 패턴 ${files.length}개`)
