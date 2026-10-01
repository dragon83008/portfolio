import { spawn } from 'node:child_process'
import { cp, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 每次构建用独立时间戳目录，避开 safe-delete bulk confirm
const outName = `dist-gh-${Date.now()}`
const output = join(root, outName)

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
    env: { ...process.env, PORTFOLIO_PUBLIC_BASE: base, PORTFOLIO_PUBLIC_SCOPE: 'all', PORTFOLIO_MEDIA_LIMIT_MB: '95', PORTFOLIO_PUBLIC_OUT: outName },
  })
  await cp(output, site, { recursive: true })
  await writeFile(join(site, '.nojekyll'), '', 'utf8')
  await run('git', ['init'], { cwd: site })
  await run('git', ['checkout', '-b', 'gh-pages'], { cwd: site })

  // 按体积分批提交并推送：单次推送 216MB 容易被代理掐断
  const batchLimit = Number(process.env.PORTFOLIO_PUSH_BATCH_MB || 45) * 1024 * 1024
  const entries = []
  for (const name of (await readdir(site, { recursive: true })).map((item) => item.replace(/\\/g, '/'))) {
    if (name.startsWith('.git')) continue
    const info = await stat(join(site, name))
    if (info.isFile()) entries.push({ name, size: info.size })
  }
  const batches = []
  let batch = []
  let size = 0
  for (const entry of entries) {
    if (batch.length && size + entry.size > batchLimit) { batches.push(batch); batch = []; size = 0 }
    batch.push(entry.name)
    size += entry.size
  }
  if (batch.length) batches.push(batch)

  const pushWithRetry = async (force) => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await run('git', force ? ['push', '--force', remote, 'HEAD:gh-pages'] : ['push', remote, 'HEAD:gh-pages'], { cwd: site })
        return
      } catch (error) {
        if (attempt === 4) throw error
        console.log(`推送中断，5 秒后重试（第 ${attempt + 1} 次）`)
        await new Promise((done) => setTimeout(done, 5000))
      }
    }
  }

  for (const [index, files] of batches.entries()) {
    await run('git', ['add', '--', ...files], { cwd: site })
    await run('git', ['-c', `user.name=${owner}`, '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', `Deploy portfolio (${index + 1}/${batches.length})`], { cwd: site })
    await pushWithRetry(index === 0)
  }
  console.log(`GitHub Pages 内容已同步：https://${owner}.github.io${base}`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
