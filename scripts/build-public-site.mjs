import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = process.env.PORTFOLIO_DATA_DIR ? resolve(process.env.PORTFOLIO_DATA_DIR) : join(root, 'data')
const output = process.env.PORTFOLIO_PUBLIC_OUT ? join(root, process.env.PORTFOLIO_PUBLIC_OUT) : join(root, 'dist-public')
const base = process.env.PORTFOLIO_PUBLIC_BASE || '/public-preview/'
const publicScope = process.env.PORTFOLIO_PUBLIC_SCOPE || 'approved'
const mediaLimitMiB = Number(process.env.PORTFOLIO_MEDIA_LIMIT_MB || 25)
const mediaFileLimit = mediaLimitMiB * 1024 * 1024
if (base !== '/' && (!/^\/[a-z0-9/-]+\/$/i.test(base) || base.includes('//') || base.includes('..'))) throw new Error('公开网站路径无效')
if (!['approved', 'all'].includes(publicScope)) throw new Error('公开作品范围无效')
if (!Number.isFinite(mediaLimitMiB) || mediaLimitMiB < 1 || mediaLimitMiB > 99) throw new Error('公开媒体大小限制无效')

const state = JSON.parse(await readFile(join(dataDir, 'portfolio.json'), 'utf8'))
const files = new Map()
const validPath = (path) => typeof path === 'string' && (/^\/portfolio\/[a-z0-9/_-]+\.(webp|jpe?g|png|mp4)$/i.test(path) || /^\/media\/[a-f0-9-]+(?:-poster)?\.(webp|mp4)$/i.test(path))
function include(path) {
  if (!validPath(path)) throw new Error(`公开素材路径无效: ${path}`)
  const source = path.startsWith('/media/') ? join(dataDir, path.slice(1)) : join(root, 'public', path.slice(1))
  files.set(path.slice(1), source)
  return `${base}${path.slice(1)}`
}

function run(command, args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? done() : reject(new Error(`${command} 执行失败`)))
  })
}

const categories = []
for (const category of state.published) {
  const projects = []
  for (const project of category.projects) {
    if (project.trashed || !project.assets.length || (publicScope === 'approved' && project.visibility !== 'public')) continue
    const coverPath = project.cover || project.assets[0]?.poster || project.assets[0]?.src
    const matching = project.assets.find((asset) => asset.src === coverPath || asset.poster === coverPath)
    let width = project.coverWidth || matching?.width
    let height = project.coverHeight || matching?.height
    if (!width || !height) {
      const source = coverPath.startsWith('/media/') ? join(dataDir, coverPath.slice(1)) : join(root, 'public', coverPath.slice(1))
      const metadata = await sharp(source).metadata()
      const rotated = metadata.orientation >= 5 && metadata.orientation <= 8
      width = rotated ? metadata.height : metadata.width
      height = rotated ? metadata.width : metadata.height
    }
    projects.push({ ...project, cover: include(coverPath), coverWidth: width, coverHeight: height,
      assets: project.assets.map((asset) => ({ ...asset, src: include(asset.src), ...(asset.poster ? { poster: include(asset.poster) } : {}) })),
    })
  }
  if (projects.length) categories.push({ id: category.id, title: category.title, cover: include(category.cover), projects })
}
if (!categories.length) throw new Error('没有已确认可公开的作品')

for (const [path, source] of files) {
  try { await stat(source) } catch { throw new Error(`公开素材缺失: ${path}`) }
}

const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
await run(process.execPath, [vite, 'build', '--mode', 'public', '--outDir', output], { env: { ...process.env, PORTFOLIO_PUBLIC_BASE: base } })
for (const [path, source] of files) {
  const destination = join(output, path)
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
  if (/\.mp4$/i.test(path) && (await stat(destination)).size >= mediaFileLimit) {
    const temporary = `${destination}.web.mp4`
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', destination, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', temporary])
    await copyFile(temporary, destination)
    await unlink(temporary)
    if ((await stat(destination)).size >= mediaFileLimit) throw new Error(`网页视频仍超过 ${mediaLimitMiB} MB: ${path}`)
  }
}
await writeFile(join(output, 'portfolio.json'), JSON.stringify(categories), 'utf8')
await writeFile(join(output, '.portfolio-managed'), 'This directory contains only approved public portfolio output.\n', 'utf8')
const bytes = (await Promise.all([...files.values()].map(async (source) => (await stat(source)).size))).reduce((sum, value) => sum + value, 0)
console.log(JSON.stringify({ categories: categories.length, projects: categories.reduce((sum, category) => sum + category.projects.length, 0), files: files.size, mediaMiB: Math.round(bytes / 1024 / 1024), base, scope: publicScope, mediaLimitMiB }))
