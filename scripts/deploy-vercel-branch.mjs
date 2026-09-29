import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'dist-public')
const branch = process.env.PORTFOLIO_VERCEL_BRANCH || 'vercel'
const mediaLimitMiB = process.env.PORTFOLIO_MEDIA_LIMIT_MB || '95'

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
const [, owner] = match
const temporary = await mkdtemp(join(tmpdir(), 'portfolio-vercel-'))
const site = join(temporary, 'site')

try {
  // Vercel 部署在域名根路径，公开站必须以 / 为基准构建
  await run(process.execPath, [join(root, 'scripts', 'build-public-site.mjs')], {
    env: { ...process.env, PORTFOLIO_PUBLIC_BASE: '/', PORTFOLIO_PUBLIC_SCOPE: 'all', PORTFOLIO_MEDIA_LIMIT_MB: mediaLimitMiB },
  })
  await cp(output, site, { recursive: true })
  // 单页应用：未知路径回退到 index.html，避免直接访问子路径 404
  await writeFile(join(site, 'vercel.json'), `${JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2)}\n`, 'utf8')
  await run('git', ['init'], { cwd: site })
  await run('git', ['checkout', '-b', branch], { cwd: site })
  await run('git', ['add', '--all'], { cwd: site })
  await run('git', ['-c', `user.name=${owner}`, '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', 'Deploy portfolio for Vercel'], { cwd: site })
  await run('git', ['push', '--force', remote, `HEAD:${branch}`], { cwd: site })
  console.log(`已推送 ${branch} 分支，Vercel 导入仓库后把 Production Branch 设为 ${branch}`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
