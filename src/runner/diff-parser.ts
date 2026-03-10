// src/runner/diff-parser.ts
// Pure function to parse unified diff output into structured data
import type { DiffFile, DiffHunk, DiffLine } from '../shared/types.js'

export function parseUnifiedDiff(raw: string): DiffFile[] {
  if (!raw.trim()) return []

  const files: DiffFile[] = []
  // Split on "diff --git" boundaries
  const fileSections = raw.split(/^diff --git /m).filter(s => s.trim())

  for (const section of fileSections) {
    const lines = section.split('\n')

    // Extract file path from "a/path b/path" header
    const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/)
    const path = headerMatch?.[2] ?? headerMatch?.[1] ?? 'unknown'

    // Check for binary file
    if (section.includes('Binary files') || section.includes('GIT binary patch')) {
      files.push({ path, additions: 0, deletions: 0, hunks: [] })
      continue
    }

    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null
    let additions = 0
    let deletions = 0

    for (const line of lines) {
      // Hunk header: @@ -start,count +start,count @@
      if (line.startsWith('@@')) {
        currentHunk = { header: line, lines: [] }
        hunks.push(currentHunk)
        continue
      }

      if (!currentHunk) continue

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({ type: 'add', content: line.slice(1) })
        additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({ type: 'delete', content: line.slice(1) })
        deletions++
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({ type: 'context', content: line.slice(1) })
      }
    }

    files.push({ path, additions, deletions, hunks })
  }

  return files
}
