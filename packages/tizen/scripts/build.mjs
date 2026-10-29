// Builds the web app for TizenBrew and copies it to ./dist, which is what gets published.
// The page is served from the TV at http://127.0.0.1:8081, so YouTube requests go to the
// proxy that service.js runs on PROXY_PORT instead of the dev server's /__proxy.
import { spawnSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROXY_PORT = 8082
const here = dirname(fileURLToPath(import.meta.url))
const app = join(here, '..', '..', 'app')
const out = join(here, '..', 'dist')

const run = spawnSync('bun', ['run', 'build'], {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, VITE_PROXY_BASE: `http://127.0.0.1:${PROXY_PORT}` },
})
if (run.status !== 0) process.exit(run.status ?? 1)

rmSync(out, { recursive: true, force: true })
cpSync(join(app, 'dist'), out, { recursive: true })
console.log(`Copied ${join(app, 'dist')} to ${out}`)
