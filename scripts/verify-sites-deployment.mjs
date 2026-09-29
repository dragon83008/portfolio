import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2]
if (!base?.startsWith('https://')) throw new Error('请提供 Sites 的 HTTPS 地址')

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(base, { waitUntil: 'networkidle' })
  const works = await page.evaluate(() => fetch('/portfolio.json').then((response) => response.json()))
  assert.equal(works.length, 4)
  assert.equal(works.flatMap((category) => category.projects).length, 9)
  assert.equal(await page.locator('.work-item').count(), works.length)
  assert.equal(await page.getByRole('button', { name: '联系我' }).count(), 0)
  await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
  await page.getByRole('button', { name: '打开品牌设计作品' }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
  await page.locator('.project-cover').first().click()
  await page.locator('.project-focus[data-mode="work"]').waitFor()
  const image = page.locator('.focus-hero-media img')
  await image.waitFor()
  await page.waitForFunction(() => {
    const node = document.querySelector('.focus-hero-media img')
    return node?.complete && node.naturalWidth > 0
  })
  assert.deepEqual(errors, [])
  await page.screenshot({ path: 'screenshots/sites-live-desktop.png', fullPage: false })
} finally {
  await browser.close()
}

console.log('Sites production smoke test PASS')
