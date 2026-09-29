import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import sharp from 'sharp'

const root = new URL('../', import.meta.url)

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('本地测试服务启动失败')
    try { if ((await fetch(`${url}/api/admin/state`)).ok) return }
    catch { /* Server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('本地测试服务启动超时')
}

async function json(url, options) {
  const response = await fetch(url, options)
  const data = await response.json()
  assert.equal(response.status, 200, data.error || url)
  return data
}

test('导入、上传、草稿与发布流程', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portfolio-admin-test-'))
  const port = 5200 + Math.floor(Math.random() * 500)
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server/server.js', '--production'], { cwd: root, env: { ...process.env, PORT: String(port), PORTFOLIO_DATA_DIR: temp }, windowsHide: true })
  try {
    await waitForServer(url, child)
    const state = await json(`${url}/api/admin/state`)
    assert.equal(state.draft.length, 5)
    assert.equal(state.draft.flatMap((category) => category.projects).length, 23)
    assert.equal(state.published.flatMap((category) => category.projects).length, 23)
    const publicData = await json(`${url}/api/public-portfolio`)
    assert.ok(publicData.flatMap((category) => category.projects).every((project) => project.visibility === 'public'))

    async function upload(bytes, name, mime) {
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: mime }), name)
      return json(`${url}/api/admin/upload`, { method: 'POST', body: form })
    }
    const portrait = await upload(await sharp({ create: { width: 400, height: 700, channels: 3, background: '#d04c4c' } }).png().toBuffer(), 'portrait.png', 'image/png')
    assert.equal(portrait.orientation, 'portrait')
    assert.equal(portrait.width, 400)
    assert.equal(portrait.height, 700)
    assert.equal((await fetch(`${url}${portrait.src}`)).status, 200)
    const landscape = await upload(await sharp({ create: { width: 900, height: 500, channels: 3, background: '#3079a4' } }).jpeg().toBuffer(), 'landscape.jpg', 'image/jpeg')
    assert.equal(landscape.orientation, 'landscape')

    const movie = join(temp, 'test-input.mp4')
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=12', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', movie], { windowsHide: true })
      ffmpeg.on('error', reject)
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('测试视频生成失败')))
    })
    const video = await upload(await readFile(movie), 'test.mp4', 'video/mp4')
    assert.equal(video.type, 'video')
    assert.equal(video.width, 640)
    assert.equal((await fetch(`${url}${video.poster}`)).status, 200)
    const audioStream = await new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1', join(temp, 'media', `${video.id}.mp4`)], { windowsHide: true })
      let output = ''
      ffprobe.stdout.on('data', (chunk) => { output += chunk })
      ffprobe.on('error', reject)
      ffprobe.on('close', (code) => code === 0 ? resolve(output) : reject(new Error('无法检查视频音轨')))
    })
    assert.match(audioStream, /aac/)

    state.draft[1].projects.push({ id: 'test-project', title: '测试竖图与视频', role: 'Independent Project', visibility: 'review', status: 'draft', trashed: false, cover: landscape.src, coverWidth: landscape.width, coverHeight: landscape.height, assets: [portrait, landscape, video] })
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })
    const uploadedCover = (await json(`${url}/api/portfolio?preview=1`))[1].projects.find((project) => project.id === 'test-project')
    assert.equal(uploadedCover.coverWidth, 900)
    assert.equal(uploadedCover.coverHeight, 500)
    const legacyDraft = (await json(`${url}/api/admin/state`)).draft
    const legacyProject = legacyDraft[1].projects.find((project) => project.id === 'test-project')
    legacyProject.cover = portrait.src
    delete legacyProject.coverWidth
    delete legacyProject.coverHeight
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: legacyDraft }) })
    const inferredCover = (await json(`${url}/api/portfolio?preview=1`))[1].projects.find((project) => project.id === 'test-project')
    assert.equal(inferredCover.coverWidth, 400)
    assert.equal(inferredCover.coverHeight, 700)
    const unchangedDraft = (await json(`${url}/api/admin/state`)).draft[1].projects.find((project) => project.id === 'test-project')
    assert.equal(unchangedDraft.coverWidth, undefined)
    const standalone = await upload(await sharp({ create: { width: 321, height: 123, channels: 3, background: '#d6d6d6' } }).png().toBuffer(), 'standalone.png', 'image/png')
    const standaloneDraft = (await json(`${url}/api/admin/state`)).draft
    standaloneDraft[1].projects.find((project) => project.id === 'test-project').cover = standalone.src
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: standaloneDraft }) })
    const measuredCover = (await json(`${url}/api/portfolio?preview=1`))[1].projects.find((project) => project.id === 'test-project')
    assert.equal(measuredCover.coverWidth, 321)
    assert.equal(measuredCover.coverHeight, 123)
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 6)
    assert.equal((await json(`${url}/api/portfolio?preview=1`))[1].projects.length, 7)
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 7)
    assert.equal((await json(`${url}/api/public-portfolio`))[1].projects.length, 3)

    const changed = await json(`${url}/api/admin/state`)
    changed.draft[1].projects.find((project) => project.id === 'test-project').trashed = true
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: changed.draft }) })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 7)
    assert.equal((await json(`${url}/api/portfolio?preview=1`))[1].projects.length, 6)
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 6)
    changed.draft[1].projects.find((project) => project.id === 'test-project').trashed = false
    changed.draft[1].projects.push({ id: 'unfinished-test', title: '未完成草稿', role: 'Independent Project', visibility: 'review', status: 'draft', trashed: false, assets: [] })
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: changed.draft }) })
    const publishResult = await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.equal(publishResult.unfinished, 1)
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 7)
    assert.equal((await json(`${url}/api/admin/state`)).draft[1].projects.find((project) => project.id === 'unfinished-test').status, 'draft')

    const beforeDelete = await json(`${url}/api/admin/state`)
    beforeDelete.draft[1].projects = beforeDelete.draft[1].projects.filter((project) => project.id !== 'test-project')
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: beforeDelete.draft }) })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 7)
    assert.equal((await json(`${url}/api/portfolio?preview=1`))[1].projects.length, 6)
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects.length, 6)
    assert.ok((await readFile(join(temp, 'originals', `${portrait.id}.png`))).length > 0)
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((done) => child.once('exit', done))
    }
    assert.ok(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`) && basename(temp).startsWith('portfolio-admin-test-'))
    await rm(temp, { recursive: true, force: true })
  }
})

test('项目删除与恢复立即同步，不发布其他草稿', { timeout: 30000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portfolio-admin-test-'))
  const port = 5700 + Math.floor(Math.random() * 500)
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server/server.js', '--production'], { cwd: root, env: { ...process.env, PORT: String(port), PORTFOLIO_DATA_DIR: temp }, windowsHide: true })
  try {
    await waitForServer(url, child)
    const state = await json(`${url}/api/admin/state`)
    const target = state.draft[1].projects[0]
    const unrelated = state.draft[1].projects[1]
    const publishedTitle = unrelated.title
    unrelated.title = '尚未发布的修改'
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })

    const update = (action) => json(`${url}/api/admin/projects/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    await update('trash')
    let current = await json(`${url}/api/portfolio`)
    assert.ok(!current[1].projects.some((project) => project.id === target.id))
    assert.equal(current[1].projects.find((project) => project.id === unrelated.id).title, publishedTitle)
    assert.ok((await json(`${url}/api/admin/state`)).draft[1].projects.find((project) => project.id === target.id).trashed)

    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.ok(!(await json(`${url}/api/portfolio`))[1].projects.some((project) => project.id === target.id))
    const afterPublish = await json(`${url}/api/admin/state`)
    afterPublish.draft[1].projects.find((project) => project.id === target.id).title = '回收站里的未发布修改'
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: afterPublish.draft }) })
    await update('restore')
    current = await json(`${url}/api/portfolio`)
    assert.ok(current[1].projects.some((project) => project.id === target.id))
    assert.equal(current[1].projects.find((project) => project.id === target.id).title, target.title)
    assert.equal(current[1].projects.find((project) => project.id === unrelated.id).title, '尚未发布的修改')

    await update('trash')
    await json(`${url}/api/admin/projects/${target.id}`, { method: 'DELETE' })
    current = await json(`${url}/api/admin/state`)
    assert.ok(!current.draft[1].projects.some((project) => project.id === target.id))
    assert.ok(!current.published[1].projects.some((project) => project.id === target.id))
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((done) => child.once('exit', done))
    }
    assert.ok(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`) && basename(temp).startsWith('portfolio-admin-test-'))
    await rm(temp, { recursive: true, force: true })
  }
})

test('首页封面可单独预览与发布，项目草稿保持不变', { timeout: 30000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portfolio-admin-test-'))
  const port = 6200 + Math.floor(Math.random() * 500)
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server/server.js', '--production'], { cwd: root, env: { ...process.env, PORT: String(port), PORTFOLIO_DATA_DIR: temp }, windowsHide: true })
  try {
    await waitForServer(url, child)
    const initial = await json(`${url}/api/admin/state`)
    const originalCover = initial.published[0].cover
    const projectId = initial.draft[0].projects[0].id
    initial.draft[0].projects[0].title = '尚未发布的项目修改'
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: initial.draft }) })
    const covers = Object.fromEntries(initial.draft.map((category) => [category.id, `/portfolio/covers/ai-${category.id}.webp`]))
    await json(`${url}/api/admin/category-covers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covers }) })
    assert.equal((await json(`${url}/api/portfolio`))[0].cover, originalCover)
    const preview = await json(`${url}/api/portfolio?coverPreview=1`)
    assert.equal(preview[0].cover, covers[initial.draft[0].id])
    assert.equal(preview[0].projects.find((item) => item.id === projectId).title, initial.published[0].projects[0].title)
    await json(`${url}/api/admin/category-covers/publish`, { method: 'POST' })
    const published = await json(`${url}/api/portfolio`)
    assert.equal(published[0].cover, covers[initial.draft[0].id])
    assert.equal(published[0].projects.find((item) => item.id === projectId).title, initial.published[0].projects[0].title)
    assert.equal((await json(`${url}/api/admin/state`)).draft[0].projects[0].title, '尚未发布的项目修改')
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((done) => child.once('exit', done))
    }
    assert.ok(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`) && basename(temp).startsWith('portfolio-admin-test-'))
    await rm(temp, { recursive: true, force: true })
  }
})

test('项目介绍沿用草稿发布，单独发布封面不会泄漏介绍', { timeout: 30000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portfolio-admin-test-'))
  const port = 6700 + Math.floor(Math.random() * 500)
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server/server.js', '--production'], { cwd: root, env: { ...process.env, PORT: String(port), PORTFOLIO_DATA_DIR: temp }, windowsHide: true })
  try {
    await waitForServer(url, child)
    const state = await json(`${url}/api/admin/state`)
    const project = state.draft[1].projects[0]
    project.description = '包装结构与材质研究。\n视觉语言保持简洁。'
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })
    assert.equal((await json(`${url}/api/portfolio?preview=1`))[1].projects[0].description, project.description)
    assert.equal((await json(`${url}/api/portfolio`))[1].projects[0].description, undefined)
    const covers = Object.fromEntries(state.draft.map((category) => [category.id, category.cover]))
    await json(`${url}/api/admin/category-covers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covers }) })
    await json(`${url}/api/admin/category-covers/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects[0].description, undefined)
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio`))[1].projects[0].description, project.description)
    project.introSections = [
      { id: 'context', title: '项目背景', body: '第一段\n\n第二段' },
      { id: 'process', title: '创作思路', body: '纯文本 <b>不解析 HTML</b>' },
    ]
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })
    assert.deepEqual((await json(`${url}/api/portfolio?preview=1`))[1].projects[0].introSections, project.introSections)
    await json(`${url}/api/admin/category-covers/publish`, { method: 'POST' })
    assert.equal((await json(`${url}/api/portfolio?coverPreview=1`))[1].projects[0].introSections, undefined)
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.deepEqual((await json(`${url}/api/portfolio`))[1].projects[0].introSections, project.introSections)
    const invalid = structuredClone(state.draft)
    invalid[1].projects[0].introSections[1].id = 'context'
    const response = await fetch(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: invalid }) })
    assert.equal(response.status, 400)
    assert.deepEqual((await json(`${url}/api/admin/state`)).draft[1].projects[0].introSections, project.introSections)
    project.introSections = []
    await json(`${url}/api/admin/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })
    await json(`${url}/api/admin/publish`, { method: 'POST' })
    assert.deepEqual((await json(`${url}/api/portfolio`))[1].projects[0].introSections, [])
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((done) => child.once('exit', done))
    }
    assert.ok(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`) && basename(temp).startsWith('portfolio-admin-test-'))
    await rm(temp, { recursive: true, force: true })
  }
})
