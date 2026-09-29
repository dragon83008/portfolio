import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174'
const categories = await (await fetch(`${base}/api/portfolio`)).json()
const brand = categories.find((category) => category.id === 'brand')
assert.ok(brand?.projects.length, 'Brand projects are missing')
assert.equal(brand.projects[0].coverWidth, 1699)
assert.equal(brand.projects[0].coverHeight, 926)

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
try {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
    await page.getByRole('button', { name: '打开品牌设计作品' }).click()
    await page.locator('.category-flow[data-phase="open"]').waitFor()
    const cover = page.locator('.project-group').first()
    const media = cover.locator('.project-cover-media')
    const metrics = await page.evaluate(() => {
      const group = document.querySelector('.project-group')
      const media = group.querySelector('.project-cover-media')
      const image = media.querySelector('img')
      const frame = media.getBoundingClientRect()
      const img = image.getBoundingClientRect()
      return {
        width: frame.width, height: frame.height,
        ratio: frame.width / frame.height,
        imageWidth: img.width, imageHeight: img.height,
        naturalRatio: image.naturalWidth / image.naturalHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }
    })
    assert.ok(Math.abs(metrics.ratio - 1699 / 926) < .01, `${width}x${height}: cover ratio ${metrics.ratio}`)
    assert.ok(Math.abs(metrics.naturalRatio - metrics.ratio) < .01, `${width}x${height}: image and frame differ`)
    assert.ok(Math.abs(metrics.imageWidth - metrics.width) < 1 && Math.abs(metrics.imageHeight - metrics.height) < 1)
    assert.ok(metrics.width <= 521 && metrics.height <= height * .72 + 1, `${width}x${height}: oversize ${JSON.stringify(metrics)}`)
    assert.equal(metrics.overflow, false)
    if (width === 1440) await page.screenshot({ path: 'screenshots/cover-sizing-brand-desktop.png' })
    if (width === 390) await page.screenshot({ path: 'screenshots/cover-sizing-brand-mobile.png' })
    if (width === 844) await page.screenshot({ path: 'screenshots/cover-sizing-brand-landscape.png' })
    if (width === 1440 || width === 390) {
      const portraitProject = brand.projects[1]
      const portrait = page.locator(`[data-project-id="${portraitProject.id}"] .project-cover-media`)
      await portrait.scrollIntoViewIfNeeded()
      await portrait.evaluate((node) => {
        const list = node.closest('.flow-scroll')
        const rect = node.getBoundingClientRect()
        list.scrollTop += (rect.top + rect.bottom) / 2 - innerHeight / 2
      })
      await page.waitForTimeout(450)
      const portraitMetrics = await portrait.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        return { width: rect.width, height: rect.height, ratio: rect.width / rect.height }
      })
      assert.ok(Math.abs(portraitMetrics.ratio - portraitProject.coverWidth / portraitProject.coverHeight) < .01)
      assert.ok(portraitMetrics.height <= height * .72 + 1)
      assert.ok((await page.locator('.flow-sidebar .motion-title').innerText()).includes(portraitProject.title))
      if (width === 1440) await page.screenshot({ path: 'screenshots/cover-sizing-brand-portrait.png' })
      await cover.scrollIntoViewIfNeeded()
      await page.waitForTimeout(450)
    }
    await media.click()
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    const focus = await page.locator('.focus-hero-media').evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height }
    })
    assert.ok(Math.abs(focus.ratio - 1699 / 926) < .01, `${width}x${height}: focus ratio ${focus.ratio}`)
    assert.ok(focus.height <= height - 128 + 1)
    if (width >= 1024) assert.ok(focus.width > metrics.width + 20, `${width}x${height}: focus did not grow`)
    if (width === 1440) await page.screenshot({ path: 'screenshots/cover-sizing-brand-focus.png' })
    await page.getByRole('button', { name: '返回项目列表' }).click()
    await page.locator('.category-flow[data-project-view="list"]').waitFor()
    const restored = await media.boundingBox()
    assert.ok(Math.abs(restored.width - metrics.width) < 1)
    console.log(`${width}x${height}: list ${Math.round(metrics.width)}x${Math.round(metrics.height)}, focus ${Math.round(focus.width)}x${Math.round(focus.height)} PASS`)
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
  await page.waitForTimeout(550)
  await page.getByRole('button', { name: '打开品牌设计作品' }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
  const target = page.locator('.project-group').first().locator('.project-cover-media')
  const start = await target.boundingBox()
  await target.click()
  await page.locator('.project-transition').waitFor()
  await page.waitForTimeout(180)
  const middle = await page.locator('.project-transition').boundingBox()
  assert.ok(middle.width > start.width && middle.width < 691, 'Project cover must grow continuously during transition')
  await page.screenshot({ path: 'screenshots/cover-sizing-transition-mid.png' })
  await page.locator('.project-focus[data-mode="work"]').waitFor()
  await page.getByRole('button', { name: '返回项目列表' }).click()
  await page.locator('.category-flow[data-project-view="list"]').waitFor()
  await page.close()
} finally {
  await browser.close()
}
