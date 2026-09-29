import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { portfolioCategories } from '../src/portfolioData.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = process.env.PORTFOLIO_DATA_DIR ? resolve(process.env.PORTFOLIO_DATA_DIR) : join(root, 'data')
const originalsDir = join(dataDir, 'originals')
const mediaDir = join(dataDir, 'media')
const tempDir = join(dataDir, 'temp')
const databaseFile = join(dataDir, 'portfolio.json')
const publicPreviewDir = join(root, 'dist-public')
for (const directory of [dataDir, originalsDir, mediaDir, tempDir]) mkdirSync(directory, { recursive: true })

const initialCategories = portfolioCategories.map((category) => ({
  id: category.id,
  title: category.title,
  cover: category.cover,
  projects: category.projects.map((project) => ({ ...project, status: 'published', trashed: false,
    cover: project.assets[0]?.poster || project.assets[0]?.src || category.cover,
    assets: project.assets.map((asset, index) => ({ ...asset, id: `${project.id}-${index + 1}` })) })),
}))
const initialState = { version: 2, draft: initialCategories, published: structuredClone(initialCategories) }

function readState() {
  if (!existsSync(databaseFile)) {
    writeState(initialState)
    return initialState
  }
  const state = JSON.parse(readFileSync(databaseFile, 'utf8'))
  if (state.version < 2) {
    for (const categories of [state.draft, state.published]) {
      for (const category of categories) {
        for (const project of category.projects) project.cover ??= project.assets[0]?.poster || project.assets[0]?.src || category.cover
      }
    }
    state.version = 2
    writeState(state)
  }
  return state
}

function writeState(state) {
  const temp = `${databaseFile}.${randomUUID()}.tmp`
  writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8')
  renameSync(temp, databaseFile)
}

function isLocalRequest(req) {
  const host = req.headers.host?.split(':')[0]
  const origin = req.headers.origin
  try { return ['127.0.0.1', 'localhost'].includes(host) && (!origin || new URL(origin).hostname === host) }
  catch { return false }
}

function validMediaPath(value) {
  return typeof value === 'string' && (/^\/portfolio\/[a-z0-9/_-]+\.(webp|jpe?g|png|mp4)$/i.test(value) || /^\/media\/[a-f0-9-]+(?:-poster)?\.(webp|mp4)$/i.test(value))
}

const coverMetadataCache = new Map()

async function projectWithCoverDimensions(project) {
  if (project.coverWidth > 0 && project.coverHeight > 0) return project
  const matchingAsset = project.assets.find((asset) => asset.src === project.cover || asset.poster === project.cover)
  if (matchingAsset) return { ...project, coverWidth: matchingAsset.width, coverHeight: matchingAsset.height }
  if (!validMediaPath(project.cover) || project.cover.endsWith('.mp4')) return project
  let dimensions = coverMetadataCache.get(project.cover)
  if (!dimensions) {
    const file = project.cover.startsWith('/media/')
      ? join(mediaDir, project.cover.slice('/media/'.length))
      : join(root, 'public', project.cover.slice(1))
    dimensions = sharp(file).metadata().then((metadata) => {
      const rotated = metadata.orientation >= 5 && metadata.orientation <= 8
      return { coverWidth: rotated ? metadata.height : metadata.width, coverHeight: rotated ? metadata.width : metadata.height }
    }).catch(() => ({}))
    coverMetadataCache.set(project.cover, dimensions)
  }
  return { ...project, ...await dimensions }
}

async function withCoverDimensions(categories) {
  return Promise.all(categories.map(async (category) => ({ ...category,
    projects: await Promise.all(category.projects.map(projectWithCoverDimensions)),
  })))
}

function validateCategories(categories) {
  if (!Array.isArray(categories) || categories.length !== 5) throw new Error('必须保留五个作品分类')
  const categoryIds = new Set(initialCategories.map((category) => category.id))
  const ids = new Set()
  for (const category of categories) {
    if (!categoryIds.delete(category.id) || typeof category.title !== 'string' || category.title.length > 60 || !validMediaPath(category.cover)) throw new Error('分类数据无效')
    if (!Array.isArray(category.projects) || category.projects.length > 200) throw new Error('项目数量超出限制')
    for (const project of category.projects) {
      if (typeof project.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(project.id) || ids.has(project.id)) throw new Error('项目 ID 重复或无效')
      ids.add(project.id)
      if (project.introSections !== undefined) {
        if (!Array.isArray(project.introSections) || project.introSections.length > 12) throw new Error('项目介绍最多 12 个分块')
        const sectionIds = new Set()
        for (const section of project.introSections) {
          if (!section || typeof section.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(section.id) || sectionIds.has(section.id) || typeof section.title !== 'string' || section.title.length > 80 || typeof section.body !== 'string' || section.body.length > 3000) throw new Error('项目介绍分块无效')
          sectionIds.add(section.id)
        }
      }
      if (typeof project.title !== 'string' || !project.title.trim() || project.title.length > 120 || (project.description !== undefined && (typeof project.description !== 'string' || project.description.length > 3000)) || (project.cover && !validMediaPath(project.cover)) || !['public', 'review'].includes(project.visibility) || !['draft', 'published'].includes(project.status) || typeof project.trashed !== 'boolean') throw new Error('项目资料无效')
      if ((project.coverWidth !== undefined || project.coverHeight !== undefined) && (!Number.isInteger(project.coverWidth) || !Number.isInteger(project.coverHeight) || project.coverWidth < 1 || project.coverHeight < 1)) throw new Error('封面尺寸无效')
      if (!Array.isArray(project.assets) || project.assets.length > 100) throw new Error('素材数量超出限制')
      for (const asset of project.assets) {
        if (typeof asset.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(asset.id) || !['image', 'video'].includes(asset.type) || !validMediaPath(asset.src) || !Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width < 1 || asset.height < 1 || (asset.type === 'video' && !validMediaPath(asset.poster))) throw new Error('素材资料无效')
      }
    }
  }
  if (categoryIds.size) throw new Error('分类不完整')
}

function run(binary, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { windowsHide: true })
    let errorOutput = ''
    child.stderr.on('data', (chunk) => { errorOutput += chunk.toString().slice(-2000) })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`${binary} 处理失败: ${errorOutput.slice(-500)}`)))
  })
}

async function probe(file) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { windowsHide: true })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('无法读取视频，请检查文件格式'))
      const { width, height } = JSON.parse(output).streams?.[0] || {}
      if (!width || !height) return reject(new Error('视频缺少有效画面'))
      resolvePromise({ width, height })
    })
  })
}

const app = express()
app.disable('x-powered-by')
app.use((req, res, next) => {
  if (!isLocalRequest(req)) return res.status(403).json({ error: '仅允许本机访问' })
  next()
})
app.use('/media', express.static(mediaDir, { immutable: true, maxAge: '1y' }))
app.use('/public-preview', express.static(publicPreviewDir))
app.use('/api', express.json({ limit: '5mb' }))

let publicBuildBusy = false
app.post('/api/admin/publication/preview', async (_req, res) => {
  if (publicBuildBusy) return res.status(409).json({ error: '公开预览正在生成，请稍候' })
  publicBuildBusy = true
  try {
    await run(process.execPath, [join(root, 'scripts', 'build-public-site.mjs')])
    const categories = JSON.parse(readFileSync(join(publicPreviewDir, 'portfolio.json'), 'utf8'))
    res.json({ ok: true, url: '/public-preview/', categories: categories.length, projects: categories.reduce((sum, category) => sum + category.projects.length, 0) })
  } catch (error) { res.status(400).json({ error: error.message }) }
  finally { publicBuildBusy = false }
})

app.get('/api/portfolio', async (req, res) => {
  try {
    const state = readState()
    const categories = req.query.preview === '1' ? state.draft : state.published
    res.json(await withCoverDimensions(categories.map((category) => ({ ...category,
      cover: req.query.coverPreview === '1' ? state.draft.find((item) => item.id === category.id)?.cover || category.cover : category.cover,
      projects: category.projects.filter((project) => !project.trashed && project.assets.length) }))))
  } catch (error) { res.status(500).json({ error: error.message }) }
})
app.get('/api/public-portfolio', async (_req, res) => {
  try {
    const state = readState()
    res.json(await withCoverDimensions(state.published.map((category) => ({ ...category, projects: category.projects.filter((project) => !project.trashed && project.visibility === 'public' && project.assets.length) }))))
  } catch (error) { res.status(500).json({ error: error.message }) }
})
app.get('/api/admin/state', (_req, res) => res.json(readState()))
app.patch('/api/admin/projects/:id', (req, res) => {
  try {
    const { action } = req.body || {}
    if (!['trash', 'restore'].includes(action)) return res.status(400).json({ error: '无效的作品操作' })
    const state = readState()
    const draftCategory = state.draft.find((category) => category.projects.some((project) => project.id === req.params.id))
    const draftProject = draftCategory?.projects.find((project) => project.id === req.params.id)
    if (!draftProject) return res.status(404).json({ error: '作品不存在' })
    const publishedProject = state.published.flatMap((category) => category.projects).find((project) => project.id === req.params.id)
    const trashed = action === 'trash'
    draftProject.trashed = trashed
    if (publishedProject) publishedProject.trashed = trashed
    writeState(state)
    res.json({ ok: true, project: draftProject, published: Boolean(publishedProject) })
  } catch (error) { res.status(400).json({ error: error.message }) }
})
app.delete('/api/admin/projects/:id', (req, res) => {
  try {
    const state = readState()
    const draftCategory = state.draft.find((category) => category.projects.some((project) => project.id === req.params.id))
    const project = draftCategory?.projects.find((item) => item.id === req.params.id)
    if (!project) return res.status(404).json({ error: '作品不存在' })
    if (!project.trashed) return res.status(400).json({ error: '请先将作品移入回收站' })
    for (const categories of [state.draft, state.published]) {
      for (const category of categories) category.projects = category.projects.filter((item) => item.id !== req.params.id)
    }
    writeState(state)
    res.json({ ok: true })
  } catch (error) { res.status(400).json({ error: error.message }) }
})
app.put('/api/admin/draft', (req, res) => {
  try {
    validateCategories(req.body.categories)
    const state = readState()
    state.draft = req.body.categories
    writeState(state)
    res.json({ ok: true })
  } catch (error) { res.status(400).json({ error: error.message }) }
})
app.patch('/api/admin/category-covers', (req, res) => {
  try {
    const covers = req.body?.covers
    if (!covers || typeof covers !== 'object' || Array.isArray(covers)) throw new Error('封面数据无效')
    const state = readState()
    const expected = state.draft.map((category) => category.id)
    if (Object.keys(covers).length !== expected.length || expected.some((id) => !validMediaPath(covers[id]))) throw new Error('必须提供五张有效封面')
    state.draft = state.draft.map((category) => ({ ...category, cover: covers[category.id] }))
    writeState(state)
    res.json({ ok: true })
  } catch (error) { res.status(400).json({ error: error.message }) }
})
app.post('/api/admin/category-covers/publish', (_req, res) => {
  try {
    const state = readState()
    const draftCovers = new Map(state.draft.map((category) => [category.id, category.cover]))
    if (state.published.some((category) => !validMediaPath(draftCovers.get(category.id)))) throw new Error('封面数据不完整')
    state.published = state.published.map((category) => ({ ...category, cover: draftCovers.get(category.id) }))
    writeState(state)
    res.json({ ok: true })
  } catch (error) { res.status(400).json({ error: error.message }) }
})
app.post('/api/admin/publish', (_req, res) => {
  try {
    const state = readState()
    validateCategories(state.draft)
    let unfinished = 0
    state.published = structuredClone(state.draft).map((category) => {
      const previous = state.published.find((item) => item.id === category.id)
      return { ...category, projects: category.projects.flatMap((project) => {
        if (project.trashed) {
          const old = previous?.projects.find((item) => item.id === project.id)
          return old ? [{ ...old, trashed: true }] : []
        }
        if (project.assets.length) return [{ ...project, status: 'published' }]
        unfinished += 1
        const old = previous?.projects.find((item) => item.id === project.id)
        return old ? [old] : []
      }) }
    })
    state.draft = structuredClone(state.draft).map((category) => ({ ...category, projects: category.projects.map((project) => ({ ...project, status: project.trashed || !project.assets.length ? project.status : 'published' })) }))
    writeState(state)
    res.json({ ok: true, unfinished })
  } catch (error) { res.status(400).json({ error: error.message }) }
})

const upload = multer({ dest: tempDir, limits: { fileSize: 1024 * 1024 * 1024, files: 1 } })
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' })
  const temp = req.file.path
  const id = randomUUID()
  const ext = extname(req.file.originalname).toLowerCase()
  const isVideo = ['.mp4', '.mov', '.m4v'].includes(ext)
  const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
  const output = join(mediaDir, `${id}.${isVideo ? 'mp4' : 'webp'}`)
  const poster = join(mediaDir, `${id}-poster.webp`)
  try {
    if (!isVideo && !isImage) throw new Error('仅支持 JPG、PNG、WebP、MP4、MOV 和 M4V')
    let dimensions
    if (isImage) {
      const metadata = await sharp(temp).metadata()
      if (!metadata.width || !metadata.height) throw new Error('图片无效')
      dimensions = { width: metadata.orientation >= 5 && metadata.orientation <= 8 ? metadata.height : metadata.width, height: metadata.orientation >= 5 && metadata.orientation <= 8 ? metadata.width : metadata.height }
      await sharp(temp).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toFile(output)
      const display = await sharp(output).metadata()
      dimensions = { width: display.width, height: display.height }
    } else {
      const source = await probe(temp)
      const scale = Math.min(1, 1280 / source.width, 720 / source.height)
      const width = Math.max(2, Math.floor(source.width * scale / 2) * 2)
      const height = Math.max(2, Math.floor(source.height * scale / 2) * 2)
      await run('ffmpeg', ['-y', '-i', temp, '-map', '0:v:0', '-map', '0:a?', '-vf', `scale=${width}:${height}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output])
      dimensions = await probe(output)
      await run('ffmpeg', ['-y', '-i', output, '-frames:v', '1', '-vf', 'scale=1200:-2', poster])
    }
    const original = join(originalsDir, `${id}${ext}`)
    renameSync(temp, original)
    const src = `/media/${id}.${isVideo ? 'mp4' : 'webp'}`
    res.json({ id, type: isVideo ? 'video' : 'image', src, ...(isVideo ? { poster: `/media/${id}-poster.webp` } : {}), ...dimensions, orientation: dimensions.height > dimensions.width * 1.1 ? 'portrait' : dimensions.width > dimensions.height * 1.1 ? 'landscape' : 'square' })
  } catch (error) {
    rmSync(temp, { force: true }); rmSync(output, { force: true }); rmSync(poster, { force: true })
    res.status(400).json({ error: error.message })
  }
})
app.use('/api', (error, _req, res, _next) => {
  res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? '文件超过 1GB，请先压缩后上传' : error.message || '上传失败' })
})

app.get('/api/admin/backup', (_req, res) => {
  readState()
  res.type('application/json').attachment('portfolio-backup.json')
  createReadStream(databaseFile).pipe(res)
})

if (process.argv.includes('--production')) {
  app.use(express.static(join(root, 'dist')))
  app.get(/.*/, (_req, res) => res.sendFile(join(root, 'dist', 'index.html')))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true, host: '127.0.0.1' }, appType: 'spa' })
  app.use(vite.middlewares)
}

const port = Number(process.env.PORT || 5174)
app.listen(port, '127.0.0.1', () => console.log(`作品集与管理端：http://127.0.0.1:${port}/`))
