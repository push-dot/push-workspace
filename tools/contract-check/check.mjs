// Compiles the lines of lines/ against a push-be schema.ts and a push-fe api-client. A drift is a type error.
//
//   BE=<push-be checkout> FE=<push-fe checkout> [ONLY="<line> ..."] [STRICT=1] node check.mjs
//
// A line waits while one side has no type to compare. A line named in ONLY, and every line under STRICT=1, must not wait.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The compiler push-fe's api-client is typechecked with.
const TYPESCRIPT = 'typescript@5.8.3'
// The text of `Missing` in contract.ts.
const MISSING = 'contract-check: push-be has no such type yet'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const schema = resolve(process.env.BE || join(root, 'push-be'), 'packages/contracts/src/schema.ts')
const client = resolve(process.env.FE || join(root, 'push-fe'), 'packages/api-client/src')

const all = readdirSync(join(here, 'lines')).map((file) => file.replace(/\.ts$/, '')).sort()
const only = (process.env.ONLY ?? '').split(/\s+/).filter(Boolean)
const lines = only.length ? only : all
const mustNotWait = only.length > 0 || process.env.STRICT === '1'

const unknown = lines.filter((line) => !all.includes(line))
if (unknown.length) fail(`no such line: ${unknown.join(' ')}\nlines: ${all.join(' ')}`)
if (!existsSync(schema)) fail(`no ${schema}`)

const { waiting, drift } = existsSync(join(client, 'bot-contract.ts'))
  ? compile()
  : { waiting: new Map(lines.map((line) => [line, 'push-fe has no bot contract yet'])), drift: new Map() }

const waits = mustNotWait ? 'missing' : 'waiting'
for (const [line, diagnostics] of drift) console.log(`drift    ${line}\n${diagnostics}`)
for (const [line, why] of waiting) console.log(`${waits}  ${line}  (${why})`)
console.log(`contract-check: ${lines.length - drift.size - waiting.size} ok, ${drift.size} drift, ${waiting.size} ${waits}`)
process.exit(drift.size || (mustNotWait && waiting.size) ? 1 : 0)

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
