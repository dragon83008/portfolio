import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const temp = await mkdtemp(join(tmpdir(), 'portfolio-focus-'))
const port = 7200 + Math.floor(Math.random() * 500)
const base = `http://127.0.0.1:${port}`
const root = new URL('../', import.meta.url)
const server = spawn(process.execPath, ['server/server.js', '--production'], { cwd: root, env: { ...process.env, PORT: String(port), PORTFOLIO_DATA_DIR: temp }, windowsHide: true })
let browser

async function api(path, options) {
  const response = await fetch(`${base}${path}`, options)
  const data = await response.json()
  assert.equal(response.ok, true, data.error || path)
  return data
}

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Test server exited')
    try { await api('/api/admin/state'); break }
    catch { await new Promise((done) => setTimeout(done, 100)) }
  }
  const state = await api('/api/admin/state')
  const brand = state.draft.find((category) => category.id === 'brand')
  const target = brand.projects[0]
  target.description = '以包装材质与视觉层级为线索。\n让画面保持清晰、克制。'
  target.introSections = [
    { id: 'context', title: '项目背景', body: target.description },
    { id: 'process', title: '创作思路', body: '测试用分块正文，不作为真实项目发布。\n\n' + '这里测试长文本自动撑开、完整阅读的效果。'.repeat(50) },
    { id: 'empty', title: '未填写', body: '  ' },
  ]
  await api('/api/admin/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: state.draft }) })
  await api('/api/admin/publish', { method: 'POST' })
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width === 390, isMobile: width === 390 })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
    await page.waitForTimeout(540)
    await page.getByRole('button', { name: '打开品牌设计作品' }).click()
    await page.locator('.category-flow[data-phase="open"]').waitFor()
    const coverRects = await page.locator('[data-project-id]').evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return { x: rect.x, top: rect.top, bottom: rect.bottom } }))
    assert.ok(coverRects.every((rect, index) => index === 0 || rect.top >= coverRects[index - 1].bottom), 'Project covers must form one vertical column')
    await page.locator('[data-project-id="sanfu"]').evaluate((node) => node.scrollIntoView({ block: 'center' }))
    if (width === 1440) {
      await page.waitForTimeout(120)
      await page.screenshot({ path: 'screenshots/flow-title-transition.png' })
    }
    await page.waitForTimeout(800)
    assert.equal(await page.locator('.title-layer:not(.title-out) h2').innerText(), '三福文创产品系列')
    await page.locator('.project-list').evaluate((node) => { node.scrollTop = 0 })
    await page.waitForTimeout(800)
    if (width === 1440) await page.screenshot({ path: 'screenshots/project-focus-list.png' })
    if (width === 390) await page.getByRole('button', { name: target.title, exact: true }).tap()
    else await page.getByRole('button', { name: target.title, exact: true }).click()
    await page.locator('.project-focus[data-mode="entering"]').waitFor()
    await page.evaluate(() => document.querySelector('[data-project-id="sanfu"] .project-cover').click())
    await page.waitForTimeout(280)
    if (width === 1440) await page.screenshot({ path: 'screenshots/project-focus-transition.png' })
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    await page.waitForTimeout(480)
    assert.equal(await page.locator('.title-layer:not(.title-out) h2').innerText(), target.title)
    assert.equal(await page.locator('.focus-assets .flow-media').count(), target.assets.length)
    assert.equal(await page.locator('.project-list').evaluate((node) => node.inert), true)
    assert.equal(await page.locator('.project-list').evaluate((node) => Number(getComputedStyle(node).opacity)), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    if (width === 1440) await page.screenshot({ path: 'screenshots/project-focus-work.png' })
    if (width === 390) await page.screenshot({ path: 'screenshots/project-focus-mobile.png' })
    if (width === 844) await page.screenshot({ path: 'screenshots/project-focus-landscape.png' })
    if (width === 390) await page.getByRole('button', { name: `查看${target.title}的项目介绍` }).tap()
    else await page.getByRole('button', { name: `查看${target.title}的项目介绍` }).click()
    await page.locator('.project-focus[data-mode="info"]').waitFor()
    await page.waitForTimeout(450)
    assert.equal(await page.locator('.intro-section').count(), 2)
    assert.match(await page.locator('.project-intro p').first().innerText(), /包装材质/)
    assert.equal(await page.locator('.intro-section').last().evaluate((node) => node.scrollHeight <= node.clientHeight + 2), true)
    await page.waitForFunction(() => document.activeElement?.classList.contains('project-intro-label'))
    if (width === 1440) await page.screenshot({ path: 'screenshots/project-focus-intro.png' })
    if (width === 390) await page.screenshot({ path: 'screenshots/project-focus-intro-mobile.png' })
    await page.keyboard.press('Escape')
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    await page.waitForFunction(() => document.activeElement?.classList.contains('focus-hero'))
    await page.keyboard.press('Escape')
    await page.locator('.category-flow[data-project-view="list"]').waitFor()
    await page.getByRole('button', { name: '三福文创产品系列', exact: true }).click()
    const listPosition = await page.locator('.project-list').evaluate((node) => node.scrollTop)
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    assert.equal(await page.getByRole('button', { name: '查看项目介绍' }).count(), 0)
    assert.equal(await page.locator('.focus-hero').isDisabled(), true)
    await page.getByRole('button', { name: '放大查看三福文创产品系列' }).first().click()
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.lightbox').count(), 0)
    await page.getByRole('button', { name: '返回项目列表' }).click()
    await page.locator('.category-flow[data-project-view="list"]').waitFor()
    assert.equal(await page.locator('.project-list').evaluate((node) => node.scrollTop), listPosition)
    await page.keyboard.press('Escape')
    await page.locator('.category-flow').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '联系我', exact: true }).click()
    await page.getByRole('dialog', { name: '联系我' }).waitFor()
    await page.waitForTimeout(450)
    assert.equal(await page.getByText('Dragon-30-0', { exact: true }).count(), 1)
    assert.equal(await page.locator('.contact-qr').evaluate((img) => img.complete && img.naturalWidth > 0), true)
    await page.getByRole('button', { name: '复制微信号' }).click()
    await page.getByText('已复制', { exact: true }).waitFor()
    if (width === 1440 || width === 320) await page.screenshot({ path: `screenshots/contact-${width}.png` })
    await page.keyboard.press('Escape')
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`${width}x${height}: focus, intro, empty intro and escape PASS`)
  }
  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await reduced.goto(base)
  await reduced.getByRole('button', { name: '查看品牌设计', exact: true }).click()
  await reduced.getByRole('button', { name: '打开品牌设计作品' }).click()
  await reduced.locator('.category-flow[data-phase="open"]').waitFor()
  await reduced.getByRole('button', { name: target.title, exact: true }).click()
  await reduced.locator('.project-focus[data-mode="work"]').waitFor()
  await reduced.getByRole('button', { name: '查看项目介绍', exact: true }).click()
  await reduced.locator('.project-focus[data-mode="info"]').waitFor()
  assert.equal(await reduced.locator('.intro-section').count(), 2)
  await reduced.close()
  const mediaPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await mediaPage.goto(base)
  for (const category of state.draft) {
    await mediaPage.getByRole('button', { name: `查看${category.title}`, exact: true }).click()
    await mediaPage.getByRole('button', { name: `打开${category.title}作品` }).click()
    await mediaPage.locator('.category-flow[data-phase="open"]').waitFor()
    assert.equal(await mediaPage.locator('.project-cover').count(), category.projects.length)
    await mediaPage.getByRole('button', { name: '返回作品分类' }).click()
    await mediaPage.locator('.category-flow').waitFor({ state: 'detached' })
  }
  await mediaPage.getByRole('button', { name: '查看商业广告', exact: true }).click()
  await mediaPage.getByRole('button', { name: '打开商业广告作品' }).click()
  await mediaPage.locator('.category-flow[data-phase="open"]').waitFor()
  await mediaPage.getByRole('button', { name: state.draft[0].projects[0].title, exact: true }).click()
  await mediaPage.locator('.project-focus[data-mode="work"]').waitFor()
  await mediaPage.locator('.focus-assets video').first().scrollIntoViewIfNeeded()
  await mediaPage.waitForFunction(() => !document.querySelector('.focus-assets video').paused)
  await mediaPage.locator('.flow-video-open').first().click()
  await mediaPage.waitForFunction(() => document.querySelector('.focus-assets video').paused)
  await mediaPage.keyboard.press('Escape')
  await mediaPage.waitForFunction(() => !document.querySelector('.focus-assets video').paused)
  await mediaPage.keyboard.press('Escape')
  await mediaPage.locator('.category-flow[data-project-view="list"]').waitFor()
  assert.equal(await mediaPage.locator('.focus-assets video').count(), 0)
  await mediaPage.goto(`${base}/?preview=1`)
  await mediaPage.getByRole('button', { name: '关于我', exact: true }).click()
  await mediaPage.getByRole('dialog', { name: '关于我' }).waitFor()
  await mediaPage.waitForTimeout(450)
  await mediaPage.screenshot({ path: 'screenshots/about-draft.png' })
  await mediaPage.close()
  const admin = await browser.newPage()
  await admin.goto(`${base}/admin`)
  await admin.getByRole('button', { name: '品牌设计' }).click()
  await admin.getByRole('button', { name: target.title }).first().click()
  assert.match(await admin.getByLabel('分块正文').first().inputValue(), /包装材质/)
  const revised = '项目介绍草稿，仅用于本地校验。'
  await admin.getByLabel('分块正文').first().fill(revised)
  await admin.getByRole('button', { name: '添加分块' }).click()
  await admin.getByLabel('分块标题').last().fill('个人职责')
  await admin.getByLabel('分块正文').last().fill('仅用于测试的职责段落。')
  await admin.getByRole('button', { name: '上移介绍4', exact: true }).click()
  assert.equal(await admin.getByLabel('分块标题').nth(2).inputValue(), '个人职责')
  admin.on('dialog', (dialog) => dialog.accept())
  await admin.getByRole('button', { name: '删除介绍4', exact: true }).click()
  await admin.getByRole('button', { name: '保存草稿' }).click()
  await admin.getByText('草稿已保存').waitFor()
  assert.equal((await api('/api/portfolio?preview=1'))[1].projects[0].introSections[0].body, revised)
  assert.equal((await api('/api/portfolio'))[1].projects[0].description, target.description)
  await admin.getByRole('button', { name: '仅发布首页封面' }).click()
  await admin.getByText('仅首页五张分类封面已发布，其他项目草稿未发布').waitFor()
  assert.equal((await api('/api/portfolio'))[1].projects[0].description, target.description)
  await admin.getByRole('button', { name: '发布全部更改' }).click()
  await admin.getByText('已发布到本地作品集').waitFor()
  assert.equal((await api('/api/portfolio'))[1].projects[0].introSections[0].body, revised)
  await admin.close()
  console.log('Reduced motion and admin description PASS')
} finally {
  if (browser) await browser.close()
  if (server.exitCode === null) {
    server.kill()
    await new Promise((done) => server.once('exit', done))
  }
  if (resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`)) await rm(temp, { recursive: true, force: true })
}
