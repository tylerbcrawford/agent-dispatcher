import { describe, it, expect } from 'vitest'
import { parseUnifiedDiff } from '../diff-parser.js'

describe('parseUnifiedDiff', () => {
  it('returns empty array for empty input', () => {
    expect(parseUnifiedDiff('')).toEqual([])
    expect(parseUnifiedDiff('   ')).toEqual([])
  })

  it('parses single-file diff with adds and deletes', () => {
    const raw = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,4 +1,4 @@
 import { foo } from './foo'
-import { bar } from './bar'
+import { baz } from './baz'

 export function main() {
@@ -10,3 +10,4 @@
   console.log('hello')
+  console.log('world')
 }
`
    const files = parseUnifiedDiff(raw)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/index.ts')
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(1)
    expect(files[0].hunks).toHaveLength(2)
    expect(files[0].hunks[0].lines.filter(l => l.type === 'add')).toHaveLength(1)
    expect(files[0].hunks[0].lines.filter(l => l.type === 'delete')).toHaveLength(1)
  })

  it('parses multi-file diff', () => {
    const raw = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,3 +1,2 @@
 line1
-removed
 line2
`
    const files = parseUnifiedDiff(raw)
    expect(files).toHaveLength(2)
    expect(files[0].path).toBe('file1.ts')
    expect(files[0].additions).toBe(1)
    expect(files[0].deletions).toBe(0)
    expect(files[1].path).toBe('file2.ts')
    expect(files[1].additions).toBe(0)
    expect(files[1].deletions).toBe(1)
  })

  it('correctly counts per-file additions/deletions', () => {
    const raw = `diff --git a/big.ts b/big.ts
--- a/big.ts
+++ b/big.ts
@@ -1,5 +1,7 @@
 context
+add1
+add2
+add3
-del1
-del2
 context
`
    const files = parseUnifiedDiff(raw)
    expect(files[0].additions).toBe(3)
    expect(files[0].deletions).toBe(2)
  })

  it('handles binary file markers', () => {
    const raw = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ
`
    const files = parseUnifiedDiff(raw)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('image.png')
    expect(files[0].additions).toBe(0)
    expect(files[0].deletions).toBe(0)
    expect(files[0].hunks).toHaveLength(0)
  })

  it('classifies context lines correctly', () => {
    const raw = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,3 @@
 before
-old
+new
 after
`
    const files = parseUnifiedDiff(raw)
    const lines = files[0].hunks[0].lines
    expect(lines[0]).toEqual({ type: 'context', content: 'before' })
    expect(lines[1]).toEqual({ type: 'delete', content: 'old' })
    expect(lines[2]).toEqual({ type: 'add', content: 'new' })
    expect(lines[3]).toEqual({ type: 'context', content: 'after' })
  })
})
