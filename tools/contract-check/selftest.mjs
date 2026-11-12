// Runs `make contract-check` on edited copies of the fixture pair, so it passes on any submodule pins.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lineCount = readdirSync(join(here, 'lines')).length
const FILES = {
  server: 'be/packages/contracts/src/schema.ts',
  client: 'fe/packages/api-client/src/bot-contract.ts',
}

const replace = (side, from, to) => (pair) => {
  const file = join(pair, FILES[side])
  const text = readFileSync(file, 'utf8')
  assert.ok(text.includes(from), `the ${side} fixture has no "${from}"`)
  writeFileSync(file, text.replace(from, to))
}
const remove = (side) => (pair) => rmSync(join(pair, FILES[side]))

const noCardRetry = replace('server', 'CardRetry: {', 'Renamed: {')

function check(edits = [], vars = []) {
  const pair = mkdtempSync(join(tmpdir(), 'contract-check-pair-'))
  try {
    cpSync(join(here, 'fixtures'), pair, { recursive: true })
    for (const edit of edits) edit(pair)
    const make = ['-s', '-C', resolve(here, '../..'), 'contract-check', `BE=${join(pair, 'be')}`, `FE=${join(pair, 'fe')}`, ...vars]
    const { status, stdout, stderr } = spawnSync('make', make, { encoding: 'utf8' })
    return { passed: status === 0, output: stdout + stderr }
  } finally {
    rmSync(pair, { recursive: true })
  }
}

test('every line passes when the two sides agree', () => {
  const { passed, output } = check([], ['STRICT=1'])
  assert.ok(passed, output)
  assert.match(output, new RegExp(`^contract-check: ${lineCount} ok, 0 drift, 0 missing$`, 'm'))
})

const DRIFTS = [
  ['the server renames a response field', 'bot', replace('server', 'displayName: string;', 'name: string;')],
  ['the server lacks a field the client reads', 'eventCancelled', replace('server', 'resumable: boolean;', '')],
  ['the client sends a required field the server does not know', 'updateBot', replace('client', 'expectedRevision: number;', 'expectedRevision: number; avatarKey: string;')],
  ['the server renames an optional body field', 'createBot', replace('server', 'displayName?: string;', 'name?: string;')],
]
for (const [name, line, edit] of DRIFTS) {
  test(`the check fails when ${name}`, () => {
    const { passed, output } = check([edit])
    assert.ok(!passed, output)
    assert.match(output, new RegExp(`^drift +${line}$`, 'm'))
  })
}

test('an event type only the server has is not drift', () => {
  const serverOnly = replace('server', 'StreamEvent: {', 'StreamEvent: {\n    seq: number;\n    type: "employer_research";\n} | {')
  const { passed, output } = check([serverOnly], ['STRICT=1'])
  assert.ok(passed, output)
})

test('a line waits while the server has no type of its name', () => {
  const { passed, output } = check([noCardRetry])
  assert.ok(passed, output)
  assert.match(output, /^waiting +cardRetry /m)
  assert.match(output, new RegExp(`^contract-check: ${lineCount - 1} ok, 0 drift, 1 waiting$`, 'm'))
})

test('a line named in ONLY fails when the server has no type of its name', () => {
  const { passed, output } = check([noCardRetry], ['ONLY=cardRetry createBot'])
  assert.ok(!passed, output)
  assert.match(output, /^contract-check: 1 ok, 0 drift, 1 missing$/m)
})

test('STRICT=1 fails when the server has no type of a line', () => {
  const { passed, output } = check([noCardRetry], ['STRICT=1'])
  assert.ok(!passed, output)
})

test('every line waits while push-fe has no bot contract, and STRICT=1 fails', () => {
  const waits = check([remove('client')])
  assert.ok(waits.passed, waits.output)
  assert.match(waits.output, new RegExp(`^contract-check: 0 ok, 0 drift, ${lineCount} waiting$`, 'm'))
  const strict = check([remove('client')], ['STRICT=1'])
  assert.ok(!strict.passed, strict.output)
})

test('the check fails when a side does not compile, even if a line waits', () => {
  const broken = replace('client', 'export type Bot =', "import type { Gone } from './gone'\nexport type Bot =")
  const { passed, output } = check([noCardRetry, broken])
  assert.ok(!passed, output)
})

test('the check fails on a line name it does not have', () => {
  const { passed, output } = check([], ['ONLY=nope'])
  assert.ok(!passed, output)
})
