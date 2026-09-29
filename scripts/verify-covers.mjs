import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const errors = []
const categories = ['商业广告', '品牌设计', '摄影作品', 'AI 设计', '短视频']

try {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'no-preference' })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/?coverPreview=1`, { waitUntil: 'domcontentloaded' })
    await page.locator('.work-item[data-offset="0"] img').waitFor()
    await page.waitForTimeout(900)
    assert.equal(await page.locator('.work-item').count(), 5)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    if (width === 1440) await page.screenshot({ path: 'screenshots/cover-preview-desktop.png' })
    if (width === 390) await page.screenshot({ path: 'screenshots/cover-preview-mobile.png' })
    if (width === 844) await page.screenshot({ path: 'screenshots/cover-preview-landscape.png' })
    for (const [index, title] of categories.entries()) {
      await page.getByRole('button', { name: `查看${title}`, exact: true }).click()
      await page.waitForTimeout(540)
      const current = page.locator('.work-item[data-offset="0"] img')
      assert.match(await current.getAttribute('src'), new RegExp(`ai-(commercial|brand|photography|ai|video)\\.webp$`))
      assert.equal(await current.evaluate((image) => image.complete && image.naturalWidth > 0), true)
      assert.equal(await page.locator('.work-caption').innerText(), title)
      assert.equal(await page.locator('.work-dots [aria-current="true"]').count(), 1)
      if (index === 4) {
        await page.getByRole('button', { name: `打开${title}作品` }).click()
        await page.locator('.flow-transition').waitFor()
        assert.match(await page.locator('.flow-transition img').first().getAttribute('src'), /ai-video\.webp$/)
        if (width === 1440) await page.screenshot({ path: 'screenshots/cover-entry-mid.png' })
        await page.locator('.category-flow[data-phase="open"]').waitFor()
        await page.getByRole('button', { name: '返回作品分类' }).click()
        await page.locator('.category-flow').waitFor({ state: 'detached' })
      }
    }
    await page.close()
    console.log(`${width}x${height}: covers, switching, entry and return PASS`)
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await page.goto(`${base}/?coverPreview=1`)
  await page.getByRole('button', { name: '查看AI 设计', exact: true }).click()
  await page.getByRole('button', { name: '打开AI 设计作品' }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
  await page.getByRole('button', { name: '返回作品分类' }).click()
  await page.locator('.category-flow').waitFor({ state: 'detached' })
  await page.close()
  const admin = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await admin.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' })
  await admin.getByRole('button', { name: '预览首页封面' }).waitFor()
  assert.equal(await admin.getByRole('button', { name: '仅发布首页封面' }).isVisible(), true)
  assert.equal(await admin.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await admin.screenshot({ path: 'screenshots/cover-admin-mobile.png' })
  await admin.close()
  assert.deepEqual(errors, [])
  console.log('Reduced motion and page errors PASS')
} finally {
  await browser.close()
}
