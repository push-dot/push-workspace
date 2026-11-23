// Compiles the lines of lines/ against a push-be schema.ts and a push-fe api-client. A drift is a type error.
//
//   BE=<push-be checkout> FE=<push-fe checkout> [ONLY="<line> ..."] [STRICT=1] node check.mjs
//
// A line waits while one side has no type to compare. A line named in ONLY, and every line under STRICT=1, must not wait.
// Without ONLY it also compares the a2ui wire frames push-fe copies from push-be. They wait and fail the same way.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The compiler push-fe's api-client is typechecked with.
const TYPESCRIPT = 'typescript@5.8.3'
// The text of `Missing` in contract.ts.
const MISSING = 'contract-check: push-be has no such type yet'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const be = resolve(process.env.BE || join(root, 'push-be'))
const schema = join(be, 'packages/contracts/src/schema.ts')
const client = resolve(process.env.FE || join(root, 'push-fe'), 'packages/api-client/src')

const all = readdirSync(join(here, 'lines')).map((file) => file.replace(/\.ts$/, '')).sort()
const only = (process.env.ONLY ?? '').split(/\s+/).filter(Boolean)
const lines = only.length ? only : all
const strict = process.env.STRICT ?? ''
// Any other value, such as STRICT=true, would run a default check that lets a line wait.
if (strict !== '' && strict !== '1') fail(`STRICT takes 1, not "${strict}"`)
const mustNotWait = only.length > 0 || strict === '1'

const unknown = lines.filter((line) => !all.includes(line))
if (unknown.length) fail(`no such line: ${unknown.join(' ')}\nlines: ${all.join(' ')}`)
if (!existsSync(schema)) fail(`no ${schema}`)
if (!existsSync(client)) fail(`no ${client}`)

const { waiting, drift } = existsSync(join(client, 'bot-contract.ts'))
  ? compile()
  : { waiting: new Map(lines.map((line) => [line, 'push-fe has no bot contract yet'])), drift: new Map() }

const golden = only.length ? null : compareFixtures()

const waits = mustNotWait ? 'missing' : 'waiting'
for (const [line, diagnostics] of drift) console.log(`drift    ${line}\n${diagnostics}`)
for (const [line, why] of waiting) console.log(`${waits}  ${line}  (${why})`)
if (golden?.wait) console.log(`${waits}  a2ui fixtures  (${golden.wait})`)
else if (golden?.drift.length) console.log(`drift    a2ui fixtures\n${golden.drift.map((why) => `  ${why}`).join('\n')}`)
else if (golden) console.log(`a2ui fixtures: ${golden.count} same`)
console.log(`contract-check: ${lines.length - drift.size - waiting.size} ok, ${drift.size} drift, ${waiting.size} ${waits}`)
const goldenFails = Boolean(golden?.drift.length || (mustNotWait && golden?.wait))
process.exit(drift.size || (mustNotWait && waiting.size) || goldenFails ? 1 : 0)

/** push-fe's copy of the a2ui wire frames must equal push-be's, byte for byte: the v0.9.1 set and every version folder under it, such as v1.0. */
function compareFixtures() {
  const sides = { 'push-be': join(be, 'packages/contracts/a2ui/fixtures'), 'push-fe': join(client, 'a2ui-fixtures') }
  const absent = Object.keys(sides).find((side) => !existsSync(sides[side]))
  if (absent) return { wait: `${absent} has no a2ui fixtures yet`, drift: [] }
  const files = (dir) => readdirSync(dir, { recursive: true }).filter((name) => statSync(join(dir, name)).isFile())
  const names = [...new Set(Object.values(sides).flatMap(files))].sort()
  const drift = names.flatMap((name) => {
    const [server, app] = Object.values(sides).map((dir) => join(dir, name))
    if (!existsSync(app)) return [`${name}: only in push-be`]
    if (!existsSync(server)) return [`${name}: only in push-fe`]
    return readFileSync(server).equals(readFileSync(app)) ? [] : [`${name}: differs`]
  })
  return { count: names.length, drift }
}

function compile() {
  const project = mkdtempSync(join(tmpdir(), 'contract-check-'))
  writeFileSync(join(project, 'tsconfig.json'), JSON.stringify({
    extends: join(here, 'tsconfig.json'),
    compilerOptions: { paths: { 'push-be/schema': [schema], 'push-fe/api-client/*': [join(client, '*')] } },
    files: lines.map((line) => join(here, 'lines', `${line}.ts`)),
  }))
  const tsc = spawnSync('npx', ['--yes', `--package=${TYPESCRIPT}`, 'tsc', '--project', project, '--pretty', 'false'], { cwd: here, encoding: 'utf8' })
  rmSync(project, { recursive: true })
  if (tsc.error) fail(`cannot run tsc: ${tsc.error.message}`)

  const waiting = new Map()
  const drift = new Map()
  // tsc prints a diagnostic as one line that starts with a path, then indented lines that explain it.
  for (const diagnostic of tsc.stdout.split(/\n(?! )/).filter(Boolean)) {
    const line = /^lines\/(\w+)\.ts\(/.exec(diagnostic)?.[1]
    // An error outside the lines can turn a contract type into `any`, and `any` agrees with everything.
    if (!line) fail(`cannot compile the two sides\n${tsc.stdout}${tsc.stderr}`)
    if (diagnostic.includes(MISSING)) waiting.set(line, 'push-be has no such type yet')
    else drift.set(line, `${drift.get(line) ?? ''}${diagnostic}\n`)
  }
  for (const line of drift.keys()) waiting.delete(line)
  if (tsc.status !== 0 && !waiting.size && !drift.size) fail(`tsc failed\n${tsc.stdout}${tsc.stderr}`)
  return { waiting, drift }
}

function fail(message) {
  console.error(`contract-check: ${message}`)
  process.exit(1)
}
