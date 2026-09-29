import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = join(root, 'content', 'project-intro-drafts.json')
const databaseFile = join(root, 'data', 'portfolio.json')
const entries = JSON.parse(await readFile(sourceFile, 'utf8'))
const origin = process.env.PORTFOLIO_LOCAL_URL || 'http://127.0.0.1:5174'
const stateResponse = await fetch(`${origin}/api/admin/state`)
if (!stateResponse.ok) throw new Error(`无法读取本地管理端：${stateResponse.status}`)
const state = await stateResponse.json()

const active = state.published.flatMap((category) => category.projects.filter((project) => !project.trashed).map((project) => ({ category, project })))
assert.equal(active.length, 25, '已发布项目数量变化，请重新核对文案范围')
assert.deepEqual(new Set(Object.keys(entries)), new Set(active.map(({ project }) => project.id)), '文案与现有项目不一致')
const draftIds = new Set(state.draft.flatMap((category) => category.projects.filter((project) => !project.trashed).map((project) => project.id)))
for (const { project } of active) {
  assert.ok(draftIds.has(project.id), `草稿中缺少项目：${project.title}`)
  const entry = entries[project.id]
  assert.ok(entry.sections.length >= 1 && entry.sections.length <= 2, `分块数量不符：${project.title}`)
  for (const section of entry.sections) {
    assert.ok(section.title.trim() && section.body.trim(), `存在空白介绍：${project.title}`)
    assert.ok(!/呃呃|播放量|转化率/.test(section.body), `需要人工复核介绍：${project.title}`)
  }
}

if (process.argv.includes('--check')) {
  console.log(`介绍草稿检查通过：${active.length} 个项目，${active.reduce((sum, { project }) => sum + entries[project.id].sections.length, 0)} 个分块`)
  process.exit(0)
}
if (!process.argv.includes('--apply')) throw new Error('请使用 --check 或 --apply')

const originalPublished = createHash('sha256').update(JSON.stringify(state.published)).digest('hex')
const draft = state.draft.map((category) => ({ ...category,
  projects: category.projects.map((project) => {
    if (project.trashed || !entries[project.id]) return project
    const sections = entries[project.id].sections.map((section, index) => ({
      id: project.introSections?.[index]?.id || `${project.id}-intro-${index + 1}`,
      title: section.title,
      body: section.body,
    }))
    return { ...project, introSections: sections, status: 'draft' }
  }),
}))

const backupDir = join(root, 'data', 'backups')
await mkdir(backupDir, { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backupFile = join(backupDir, `portfolio-before-intros-${stamp}.json`)
await copyFile(databaseFile, backupFile)
const response = await fetch(`${origin}/api/admin/draft`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ categories: draft }),
})
if (!response.ok) throw new Error(`保存介绍草稿失败：${JSON.stringify(await response.json())}`)

const saved = await (await fetch(`${origin}/api/admin/state`)).json()
assert.equal(createHash('sha256').update(JSON.stringify(saved.published)).digest('hex'), originalPublished, '已发布内容意外变化')
for (const category of saved.draft) for (const project of category.projects) {
  if (project.trashed || !entries[project.id]) continue
  assert.deepEqual(project.introSections.map(({ title, body }) => ({ title, body })), entries[project.id].sections)
}

const lines = ['# 项目介绍草稿审阅', '', '以下文字已写入本地管理端草稿，尚未发布。预览：<http://127.0.0.1:5174/?preview=1>', '', '请逐项检查措辞、名称与事实。确认后先核对其他已有草稿，再决定发布范围；不要直接发布全部更改。', '']
for (const category of state.published) {
  const projects = category.projects.filter((project) => !project.trashed)
  lines.push(`## ${category.title}`, '')
  for (const project of projects) {
    const entry = entries[project.id]
    lines.push(`### ${project.title}`, '')
    for (const section of entry.sections) lines.push(`**${section.title}**：${section.body}`, '')
    if (entry.questions?.length) lines.push(`待确认：${entry.questions.join(' ')}`, '')
  }
}
const reviewFile = join(root, 'project-intro-review.md')
await writeFile(reviewFile, `${lines.join('\n')}\n`, 'utf8')
console.log(JSON.stringify({ projects: active.length, sections: active.reduce((sum, { project }) => sum + entries[project.id].sections.length, 0), backupFile, reviewFile }))
