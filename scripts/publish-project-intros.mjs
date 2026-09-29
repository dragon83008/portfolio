import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databaseFile = join(root, 'data', 'portfolio.json')
const entries = JSON.parse(await readFile(join(root, 'content', 'project-intro-drafts.json'), 'utf8'))
const original = await readFile(databaseFile, 'utf8')
const state = JSON.parse(original)
const ids = Object.keys(entries)
const publishedProjects = state.published.flatMap((category) => category.projects.filter((project) => !project.trashed))
const draftProjects = new Map(state.draft.flatMap((category) => category.projects.filter((project) => !project.trashed).map((project) => [project.id, project])))
assert.equal(ids.length, 25, '介绍项目数量已变化')
assert.deepEqual(new Set(ids), new Set(publishedProjects.map((project) => project.id)), '已发布项目与介绍清单不一致')

for (const project of publishedProjects) {
  const draft = draftProjects.get(project.id)
  assert.ok(draft, `草稿中缺少项目：${project.title}`)
  assert.ok(Array.isArray(draft.introSections), `介绍缺失：${project.title}`)
  assert.deepEqual(draft.introSections.map(({ title, body }) => ({ title, body })), entries[project.id].sections, `介绍尚未核对：${project.title}`)
  assert.ok(draft.introSections.every((section) => section.id && section.title.trim() && section.body.trim()), `介绍存在空块：${project.title}`)
}

if (process.argv.includes('--check')) {
  console.log(`可单独发布 ${ids.length} 个项目的介绍；其他草稿不会发布`)
  process.exit(0)
}
if (!process.argv.includes('--apply')) throw new Error('请使用 --check 或 --apply')

const next = structuredClone(state)
for (const category of next.published) for (const project of category.projects) {
  if (project.trashed || !entries[project.id]) continue
  project.introSections = structuredClone(draftProjects.get(project.id).introSections)
}
let stillDraft = 0
for (const category of next.draft) for (const project of category.projects) {
  if (project.trashed || !entries[project.id]) continue
  const live = next.published.flatMap((item) => item.projects).find((item) => item.id === project.id)
  const { status: _draftStatus, ...draftFields } = project
  const { status: _liveStatus, ...liveFields } = live
  if (isDeepStrictEqual(draftFields, liveFields)) project.status = 'published'
  else stillDraft += 1
}

const backupDir = join(root, 'data', 'backups')
await mkdir(backupDir, { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backupFile = join(backupDir, `portfolio-before-intro-publish-${stamp}.json`)
await copyFile(databaseFile, backupFile)
assert.equal(await readFile(databaseFile, 'utf8'), original, '数据在发布前发生变化，请重试')
const tempFile = `${databaseFile}.${randomUUID()}.tmp`
await writeFile(tempFile, JSON.stringify(next, null, 2), 'utf8')
await rename(tempFile, databaseFile)

const saved = JSON.parse(await readFile(databaseFile, 'utf8'))
assert.deepEqual(saved.published, next.published)
console.log(JSON.stringify({ projects: ids.length, sections: ids.reduce((sum, id) => sum + entries[id].sections.length, 0), otherDraftProjects: stillDraft, backupFile }))
