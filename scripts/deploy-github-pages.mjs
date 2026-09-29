import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'dist-public')

function run(command, args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? done() : reject(new Error(`${command} 执行失败`)))
  })
}

function capture(command, args) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? done(stdout.trim()) : reject(new Error(stderr.trim() || `${command} 执行失败`)))
  })
}

const remote = await capture('git', ['remote', 'get-url', 'origin'])
const match = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i)
if (!match) throw new Error('origin 不是有效的 GitHub 仓库地址')
const [, owner, repository] = match
const base = repository.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${repository}/`
const temporary = await mkdtemp(join(tmpdir(), 'portfolio-pages-'))
const site = join(temporary, 'site')

try {
  await run(process.execPath, [join(root, 'scripts', 'build-public-site.mjs')], {
    env: { ...process.env, PORTFOLIO_PUBLIC_BASE: base, PORTFOLIO_PUBLIC_SCOPE: 'all', PORTFOLIO_MEDIA_LIMIT_MB: '95' },
  })
  await cp(output, site, { recursive: true })
  await writeFile(join(site, '.nojekyll'), '', 'utf8')
  await run('git', ['init'], { cwd: site })
  await run('git', ['checkout', '-b', 'gh-pages'], { cwd: site })
  await run('git', ['add', '--all'], { cwd: site })
  await run('git', ['-c', `user.name=${owner}`, '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', 'Deploy portfolio'], { cwd: site })
  await run('git', ['push', '--force', remote, 'HEAD:gh-pages'], { cwd: site })
  console.log(`GitHub Pages 内容已同步：https://${owner}.github.io${base}`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
