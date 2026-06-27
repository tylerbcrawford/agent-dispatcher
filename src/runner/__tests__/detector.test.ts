import { describe, it, expect } from 'vitest'
import { detectSignal, detectQuestion, parseStreamJsonSessionId, parseVerificationReport, isPermissionDenial, updateDenialCount } from '../detector.js'

describe('detectSignal', () => {
  it('detects COMPLETED signal', () => {
    expect(detectSignal('All done. [COMPLETED]')).toEqual({ type: 'completed' })
  })

  it('detects PLAN_READY signal', () => {
    expect(detectSignal('[PLAN_READY]')).toEqual({ type: 'plan_ready' })
  })

  it('detects NEEDS_HELP with reason', () => {
    expect(detectSignal('[NEEDS_HELP: Which quality profile?]'))
      .toEqual({ type: 'needs_help', reason: 'Which quality profile?' })
  })

  it('detects PARTIAL with summary', () => {
    expect(detectSignal('[PARTIAL: Got 80% done, need API key]'))
      .toEqual({ type: 'partial', summary: 'Got 80% done, need API key' })
  })

  it('returns null for normal output', () => {
    expect(detectSignal('Analyzing project config...')).toBeNull()
  })

  it('ignores [COMPLETED] in echoed prompt (stream-json user message)', () => {
    // --verbose stream-json echoes the prompt which may contain signal markers
    const chunk = '{"type":"user","message":{"role":"user","content":"After writing, output [COMPLETED]"},"session_id":"abc"}'
    expect(detectSignal(chunk)).toBeNull()
  })

  it('detects [COMPLETED] in assistant text content (stream-json)', () => {
    const chunk = '{"type":"text","text":"All done. [COMPLETED]"}'
    expect(detectSignal(chunk)).toEqual({ type: 'completed' })
  })

  it('detects VERIFIED signal', () => {
    const chunk = '{"type":"text","text":"All checks pass. [VERIFIED]"}'
    expect(detectSignal(chunk)).toEqual({ type: 'verified' })
  })

  it('[VERIFIED] takes priority over [COMPLETED] when both present', () => {
    const chunk = '{"type":"text","text":"[COMPLETED] and [VERIFIED]"}'
    expect(detectSignal(chunk)).toEqual({ type: 'verified' })
  })

  // Gemini stream-json format
  it('detects [COMPLETED] in gemini assistant message', () => {
    const chunk = '{"type":"message","role":"assistant","content":"Task finished. [COMPLETED]","delta":true}'
    expect(detectSignal(chunk)).toEqual({ type: 'completed' })
  })

  it('detects [PLAN_READY] in gemini assistant message', () => {
    const chunk = '{"type":"message","role":"assistant","content":"Plan saved. [PLAN_READY]","delta":true}'
    expect(detectSignal(chunk)).toEqual({ type: 'plan_ready' })
  })

  it('ignores gemini user messages', () => {
    const chunk = '{"type":"message","role":"user","content":"After writing, output [COMPLETED]"}'
    expect(detectSignal(chunk)).toBeNull()
  })

  // Codex --json format (JSON-RPC notifications)
  it('detects [COMPLETED] in codex agentMessage delta', () => {
    const chunk = '{"method":"item/agentMessage/delta","params":{"itemId":"item_1","delta":"All done. [COMPLETED]"}}'
    expect(detectSignal(chunk)).toEqual({ type: 'completed' })
  })

  it('detects [PLAN_READY] in codex agentMessage delta', () => {
    const chunk = '{"method":"item/agentMessage/delta","params":{"itemId":"item_1","delta":"Plan saved. [PLAN_READY]"}}'
    expect(detectSignal(chunk)).toEqual({ type: 'plan_ready' })
  })
})

describe('detectQuestion', () => {
  it('detects question patterns in output', () => {
    expect(detectQuestion('Which quality profile should I use?')).toBe(true)
    expect(detectQuestion('Should I proceed with this approach?')).toBe(true)
  })

  it('does not flag normal output as questions', () => {
    expect(detectQuestion('Reading docker-compose.yml...')).toBe(false)
    expect(detectQuestion('Found 115 series with quality profiles')).toBe(false)
  })

  it('blocks Claudesidian system prompt patterns', () => {
    expect(detectQuestion('Might any skill apply?')).toBe(false)
    expect(detectQuestion('digraph skill_flow { "Should I check?" }')).toBe(false)
    expect(detectQuestion('claudesidian would you like to proceed?')).toBe(false)
    expect(detectQuestion('If a skill might apply to your task, should I invoke it?')).toBe(false)
  })
})

describe('parseVerificationReport', () => {
  it('parses markdown checklist with pass/fail/skip/warn', () => {
    const output = [
      '## Verification',
      '- [x] Unit tests: 132 pass, 0 fail',
      '- [ ] Lint: 2 errors found',
      '- [SKIP] Docker: not applicable',
      '- [WARN] Performance: 200ms response time',
      '## Summary',
      'Implemented the feature successfully.',
    ].join('\n')
    const report = parseVerificationReport(output)
    expect(report).not.toBeNull()
    expect(report!.checks).toHaveLength(4)
    expect(report!.checks[0]).toEqual({ name: 'Unit tests', status: 'pass', detail: '132 pass, 0 fail' })
    expect(report!.checks[1]).toEqual({ name: 'Lint', status: 'fail', detail: '2 errors found' })
    expect(report!.checks[2]).toEqual({ name: 'Docker', status: 'skip', detail: 'not applicable' })
    expect(report!.checks[3]).toEqual({ name: 'Performance', status: 'warn', detail: '200ms response time' })
    expect(report!.summary).toBe('Implemented the feature successfully.')
  })

  it('returns null when no checklist found', () => {
    expect(parseVerificationReport('Just some normal text output')).toBeNull()
    expect(parseVerificationReport('')).toBeNull()
  })

  it('parses from stream-json text content', () => {
    const chunk = '{"type":"text","text":"## Verification\\n- [x] Tests: all pass\\n## Summary\\nDone."}'
    const report = parseVerificationReport(chunk)
    expect(report).not.toBeNull()
    expect(report!.checks).toHaveLength(1)
    expect(report!.checks[0].status).toBe('pass')
    expect(report!.summary).toBe('Done.')
  })
})

describe('parseStreamJsonSessionId', () => {
  it('extracts session ID from claude system handshake', () => {
    const line = '{"type":"system","session_id":"abc-123-def"}'
    expect(parseStreamJsonSessionId(line)).toBe('abc-123-def')
  })

  it('extracts session ID from gemini init handshake', () => {
    const line = '{"type":"init","session_id":"c16f3b82-9b81-4f87-85e2-92d00c4ddee3","model":"gemini-2.5-flash"}'
    expect(parseStreamJsonSessionId(line)).toBe('c16f3b82-9b81-4f87-85e2-92d00c4ddee3')
  })

  it('returns null for non-system messages', () => {
    const line = '{"type":"assistant","content":"Hello"}'
    expect(parseStreamJsonSessionId(line)).toBeNull()
  })

  it('returns null for non-JSON output', () => {
    expect(parseStreamJsonSessionId('Reading file...')).toBeNull()
  })

  it('extracts thread ID from codex thread/started event', () => {
    const line = '{"method":"thread/started","params":{"thread":{"id":"thr_abc123"}}}'
    expect(parseStreamJsonSessionId(line)).toBe('thr_abc123')
  })
})

// Real stream-json fixtures captured 2026-06-20 from `claude --print --disallowedTools=Write,Bash`
const DENIAL = '{"type":"user","message":{"content":[{"type":"tool_result","is_error":true,"content":[{"type":"text","text":"<tool_use_error>Error: No such tool available: Write. Write exists but is not enabled in this context. Use one of the available tools instead.</tool_use_error>"}]}]}}'
const SUCCESS = '{"type":"user","message":{"content":[{"type":"tool_result","is_error":false,"content":[{"type":"text","text":"file contents here"}]}]}}'
const FILE_ERROR = '{"type":"user","message":{"content":[{"type":"tool_result","is_error":true,"content":[{"type":"text","text":"<tool_use_error>File does not exist.</tool_use_error>"}]}]}}'

describe('isPermissionDenial', () => {
  it('detects a profile-denied tool result', () => {
    expect(isPermissionDenial(DENIAL)).toBe(true)
  })
  it('does not flag a successful tool result', () => {
    expect(isPermissionDenial(SUCCESS)).toBe(false)
  })
  it('does not flag a non-denial tool error (missing file is is_error:true but not a denial)', () => {
    expect(isPermissionDenial(FILE_ERROR)).toBe(false)
  })
  it('does not flag plain assistant text', () => {
    expect(isPermissionDenial('I will now use the Write tool.')).toBe(false)
  })
})

describe('updateDenialCount', () => {
  it('increments on a denial chunk', () => {
    expect(updateDenialCount(0, DENIAL)).toBe(1)
    expect(updateDenialCount(2, DENIAL)).toBe(3)
  })
  it('resets to 0 on a successful tool result (agent made progress)', () => {
    expect(updateDenialCount(2, SUCCESS)).toBe(0)
  })
  it('leaves the count unchanged on neutral output (text/thinking between denials)', () => {
    expect(updateDenialCount(2, 'thinking about the problem...')).toBe(2)
  })
})
