/**
 * Fails the build if anything in out/ is empty or missing.
 *
 * A build once emitted zero-byte JS and CSS chunks while still reporting the
 * correct sizes on stdout. The app then launched fine, registered its tray,
 * ticked its timers — and every window rendered blank, because the bundles
 * had no content. Nothing in the normal build output revealed it.
 *
 * Runs automatically after `npm run build`.
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'out')

const REQUIRED = [
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/break.html',
  'out/renderer/settings.html'
]

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

let failed = false

for (const required of REQUIRED) {
  const full = join(ROOT, required)
  try {
    if (statSync(full).size === 0) throw new Error('empty')
  } catch {
    console.error(`✗ missing or empty: ${required}`)
    failed = true
  }
}

let checked = 0
for (const file of walk(OUT)) {
  checked += 1
  if (statSync(file).size === 0) {
    console.error(`✗ zero-byte artifact: ${relative(ROOT, file)}`)
    failed = true
  }
}

if (failed) {
  console.error('\nBuild verification failed — do not package this output.')
  process.exit(1)
}

console.log(`✓ build verified (${checked} files, none empty)`)
