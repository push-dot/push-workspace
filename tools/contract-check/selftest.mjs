// Runs `make contract-check` on edited copies of the fixture pair, so it passes on any submodule pins.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
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
const GOLDEN = { server: 'be/packages/contracts/a2ui/fixtures', client: 'fe/packages/api-client/src/a2ui-fixtures' }
const golden = (side, edit) => (pair) => edit(join(pair, GOLDEN[side]))

const noCardRetry = replace('server', 'CardRetry: {', 'Renamed: {')
const noServerTypes = (pair) => writeFileSync(join(pair, FILES.server), 'export interface paths {}\nexport interface operations {}\nexport interface components { schemas: {} }\n')

function check(edits = [], vars = {}, env = {}) {
  const pair = mkdtempSync(join(tmpdir(), 'contract-check-pair-'))
  try {
    cpSync(join(here, 'fixtures'), pair, { recursive: true })
    for (const edit of edits) edit(pair)
    // ONLY and STRICT are always passed, so a value the caller's shell or make exported does not reach the check.
    const assignments = Object.entries({ BE: join(pair, 'be'), FE: join(pair, 'fe'), ONLY: '', STRICT: '', ...vars })
    const make = ['-s', '-C', resolve(here, '../..'), 'contract-check', ...assignments.map(([name, value]) => `${name}=${value}`)]
    const { status, stdout, stderr } = spawnSync('make', make, { encoding: 'utf8', env: { ...process.env, ...env } })
    return { passed: status === 0, output: stdout + stderr }
  } finally {
    rmSync(pair, { recursive: true })
  }
}

test('every line passes when the two sides agree', () => {
  const { passed, output } = check([], { STRICT: 1 })
  assert.ok(passed, output)
  assert.match(output, new RegExp(`^contract-check: ${lineCount} ok, 0 drift, 0 missing$`, 'm'))
  assert.match(output, /^a2ui fixtures: 2 same$/m)
})

const DRIFTS = [
  ['the server renames a response field', 'bot', replace('server', 'displayName: string;', 'name: string;')],
  ['the server lacks a field the client reads', 'eventCancelled', replace('server', 'resumable: boolean;', '')],
  ['the server types the events of a turn without the event types the client reads', 'transcript', replace('server', 'events: components["schemas"]["StreamEvent"][];', 'events: { [key: string]: unknown }[];')],
  ['the client leaves out a body field the server requires', 'updateBot', replace('client', 'expectedRevision: number; ', '')],
  ['the client sends a required field the server does not know', 'updateBot', replace('client', 'expectedRevision: number;', 'expectedRevision: number; avatarKey: string;')],
  ['the server may leave out a field the client requires', 'bot', replace('server', 'displayName: string;', 'displayName?: string;')],
  ['the server renames a field of a site grant', 'botSiteGrants', replace('server', 'grantedAt: string;', 'at: string;')],
  ['the server drops the site grant DELETE route', 'botSiteGrantDelete', replace('server', '{ delete: unknown }', '{ get: unknown }')],
  ['the server answers a card with another status', 'cardAnswer', replace('server', 'status: "APPROVED" | "REJECTED";\n        };\n        BotSiteGrant', 'status: number;\n        };\n        BotSiteGrant')],
  ['the server renames the surface id of an a2ui frame', 'eventA2ui', replace('server', 'surfaceId: string;', 'id: string;')],
  ['the server renames an optional body field', 'createBot', replace('server', 'displayName?: string;', 'name?: string;')],
  ['the server renames an optional field inside a body', 'send', replace('server', 'model?: string;', 'modelId?: string;')],
  ['an item of a body array has a key the server does not know', 'send', replace('client', '{ kind: string; id: string }[]', '{ kind: string; id: string; title?: string }[]')],
  ['one member of a body union has a key the server does not know', 'createBot', replace('client', '{ postingId: string; displayName?: string }', '{ postingId: string; displayName?: string } | { postingId: string; companyName: string }')],
]
for (const [name, line, edit] of DRIFTS) {
  test(`the check fails when ${name}`, () => {
    const { passed, output } = check([edit])
    assert.ok(!passed, output)
    assert.match(output, new RegExp(`^drift +${line}$`, 'm'))
  })
}

test('a line whose server type has another shape is drift, not missing', () => {
  const kindIsNumber = replace('server', 'kind?: "posting" | "conversation" | "bot";', 'kind?: number;')
  const { passed, output } = check([kindIsNumber], { STRICT: 1 })
  assert.ok(!passed, output)
  assert.match(output, new RegExp(`^contract-check: ${lineCount - 1} ok, 1 drift, 0 missing$`, 'm'))
})

test('an event type only the server has is not drift', () => {
  const serverOnly = replace('server', 'StreamEvent: {', 'StreamEvent: {\n    seq: number;\n    type: "employer_research";\n} | {')
  const { passed, output } = check([serverOnly], { STRICT: 1 })
  assert.ok(passed, output)
})

test('a line waits while the server has no type of its name', () => {
  const { passed, output } = check([noCardRetry])
  assert.ok(passed, output)
  assert.match(output, /^waiting +cardRetry /m)
  assert.match(output, new RegExp(`^contract-check: ${lineCount - 1} ok, 0 drift, 1 waiting$`, 'm'))
})

test('a line named in ONLY fails when the server has no type of its name', () => {
  const { passed, output } = check([noCardRetry], { ONLY: 'cardRetry createBot' })
  assert.ok(!passed, output)
  assert.match(output, /^contract-check: 1 ok, 0 drift, 1 missing$/m)
})

test('STRICT=1 fails every line when the server has none of the types', () => {
  const { passed, output } = check([noServerTypes], { STRICT: 1 })
  assert.ok(!passed, output)
  assert.match(output, new RegExp(`^contract-check: 0 ok, 0 drift, ${lineCount} missing$`, 'm'))
})

test('the check refuses a STRICT value other than 1', () => {
  const { passed, output } = check([noCardRetry], { STRICT: 'true' })
  assert.ok(!passed, output)
})

test('every line waits while push-fe has no bot contract, and STRICT=1 fails', () => {
  const waits = check([remove('client')])
  assert.ok(waits.passed, waits.output)
  assert.match(waits.output, new RegExp(`^contract-check: 0 ok, 0 drift, ${lineCount} waiting$`, 'm'))
  const strict = check([remove('client')], { STRICT: 1 })
  assert.ok(!strict.passed, strict.output)
})

for (const side of ['BE', 'FE']) {
  test(`the check fails when the ${side} checkout is not there`, () => {
    const { passed, output } = check([], { [side]: join(tmpdir(), 'contract-check-no-such-checkout') })
    assert.ok(!passed, output)
  })
}

test('the check fails when a side does not compile, even if a line waits', () => {
  const broken = replace('client', 'export type Bot =', "import type { Gone } from './gone'\nexport type Bot =")
  const { passed, output } = check([noCardRetry, broken])
  assert.ok(!passed, output)
})

test('the check fails when the compiler does not run', () => {
  const bin = mkdtempSync(join(tmpdir(), 'contract-check-bin-'))
  try {
    writeFileSync(join(bin, 'npx'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    const { passed, output } = check([], {}, { PATH: `${bin}${delimiter}${process.env.PATH}` })
    assert.ok(!passed, output)
  } finally {
    rmSync(bin, { recursive: true })
  }
})

const GOLDEN_DRIFTS = [
  ['the client copy of an a2ui fixture differs', golden('client', (dir) => writeFileSync(join(dir, 'todo.json'), '{}\n')), /^  todo\.json: differs$/m],
  ['the client lacks an a2ui fixture the server has', golden('client', (dir) => rmSync(join(dir, 'todo.json'))), /^  todo\.json: only in push-be$/m],
  ['the client has an a2ui fixture the server lacks', golden('client', (dir) => writeFileSync(join(dir, 'extra.json'), '{}\n')), /^  extra\.json: only in push-fe$/m],
  ['the client copy of a v1.0 fixture differs', golden('client', (dir) => writeFileSync(join(dir, 'v1.0/todo.json'), '{}\n')), /^  v1\.0\/todo\.json: differs$/m],
  ['the client lacks the v1.0 set the server has', golden('client', (dir) => rmSync(join(dir, 'v1.0'), { recursive: true })), /^  v1\.0\/todo\.json: only in push-be$/m],
  ['the server lacks the v1.0 set the client has', golden('server', (dir) => rmSync(join(dir, 'v1.0'), { recursive: true })), /^  v1\.0\/todo\.json: only in push-fe$/m],
]
for (const [name, edit, line] of GOLDEN_DRIFTS) {
  test(`the check fails when ${name}`, () => {
    const { passed, output } = check([edit])
    assert.ok(!passed, output)
    assert.match(output, /^drift +a2ui fixtures$/m)
    assert.match(output, line)
  })
}

test('the a2ui fixtures wait while push-be has none, and STRICT=1 fails', () => {
  const noServerFixtures = golden('server', (dir) => rmSync(dir, { recursive: true }))
  const waits = check([noServerFixtures])
  assert.ok(waits.passed, waits.output)
  assert.match(waits.output, /^waiting +a2ui fixtures +\(push-be has no a2ui fixtures yet\)$/m)
  const strict = check([noServerFixtures], { STRICT: 1 })
  assert.ok(!strict.passed, strict.output)
})

test('ONLY skips the a2ui fixtures', () => {
  const { passed, output } = check([golden('client', (dir) => writeFileSync(join(dir, 'todo.json'), '{}\n'))], { ONLY: 'eventA2ui' })
  assert.ok(passed, output)
  assert.doesNotMatch(output, /a2ui fixtures/)
})

test('the check fails on a line name it does not have', () => {
  const { passed, output } = check([], { ONLY: 'nope' })
  assert.ok(!passed, output)
})
