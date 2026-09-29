import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5176'
const response = await fetch(`${base}/api/admin/publication/preview`, { method: 'POST' })
assert.equal(response.status, 200, await response.text())
const works = await (await fetch(`${base}/public-preview/portfolio.json`)).json()
assert.ok(works.length > 0)
assert.ok(works.every((category) => category.projects.length > 0))
assert.ok(works.flatMap((category) => category.projects).every((project) => project.visibility === 'public' && !project.trashed))
assert.ok(!(await readdir('dist-public')).includes('admin'))
const bundle = (await readFile(`dist-public/assets/${(await readdir('dist-public/assets')).find((name) => name.endsWith('.js'))}`, 'utf8'))
assert.ok(!bundle.includes('Dragon-30-0') && !bundle.includes('3266830274@qq.com'))

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/public-preview/`, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('.work-item').count(), works.length)
    assert.equal(await page.getByRole('button', { name: '联系我' }).count(), 0)
    await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
    await page.getByRole('button', { name: '打开品牌设计作品' }).click()
    await page.locator('.category-flow[data-phase="open"]').waitFor()
    await page.locator('.project-cover').first().click()
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    const image = page.locator('.focus-hero-media img')
    await image.waitFor()
    assert.ok(await image.evaluate((node) => node.complete && node.naturalWidth > 0))
    assert.deepEqual(errors, [])
    await page.screenshot({ path: `screenshots/public-preview-${width}.png` })
    await page.close()
  }
} finally {
  await browser.close()
}
console.log(`Public preview: ${works.length} categories and ${works.flatMap((category) => category.projects).length} projects PASS`)
