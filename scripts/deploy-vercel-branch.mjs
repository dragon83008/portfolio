import { spawn } from 'node:child_process'
import { cp, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 单独的输出目录，避免覆盖 GitHub Pages 用的 dist-public
const outName = process.env.PORTFOLIO_PUBLIC_OUT || 'dist-vercel'
const output = join(root, outName)
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
    env: { ...process.env, PORTFOLIO_PUBLIC_BASE: '/', PORTFOLIO_PUBLIC_SCOPE: 'all', PORTFOLIO_MEDIA_LIMIT_MB: mediaLimitMiB, PORTFOLIO_PUBLIC_OUT: outName },
  })
  await cp(output, site, { recursive: true })
  // 单页应用：未知路径回退到 index.html，避免直接访问子路径 404
  await writeFile(join(site, 'vercel.json'), `${JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2)}\n`, 'utf8')
  await run('git', ['init'], { cwd: site })
  await run('git', ['checkout', '-b', branch], { cwd: site })

  // 按体积分批提交并推送：单次推送数据过多时连接容易被重置
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
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await run('git', force ? ['push', '--force', remote, `HEAD:${branch}`] : ['push', remote, `HEAD:${branch}`], { cwd: site })
        return
      } catch (error) {
        if (attempt === 3) throw error
        console.log(`推送中断，5 秒后重试（第 ${attempt + 1} 次）`)
        await new Promise((done) => setTimeout(done, 5000))
      }
    }
  }

  for (const [index, files] of batches.entries()) {
    await run('git', ['add', '--', ...files], { cwd: site })
    await run('git', ['-c', `user.name=${owner}`, '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', `Deploy portfolio for Vercel (${index + 1}/${batches.length})`], { cwd: site })
    await pushWithRetry(index === 0)
  }
  console.log(`已推送 ${branch} 分支，Vercel 导入仓库后把 Production Branch 设为 ${branch}`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
