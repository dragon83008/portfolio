import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174'
const categories = await (await fetch(`${base}/api/portfolio`)).json()
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const errors = []

async function openCategory(page, category) {
  await page.getByRole('button', { name: `查看${category.title}`, exact: true }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: `打开${category.title}作品` }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
}

try {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (error) => errors.push(`${width}x${height}: ${error.message}`))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    const category = categories.find((item) => item.id === 'brand')
    await openCategory(page, category)
    assert.equal(await page.locator('.project-cover').count(), category.projects.length)
    assert.equal(await page.locator('.project-focus').count(), 0)

    const first = category.projects[0]
    await page.getByRole('button', { name: first.title, exact: true }).click()
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    assert.equal(await page.locator('.focus-assets .flow-media').count(), first.assets.length)
    const metrics = await page.evaluate(() => {
      const cover = document.querySelector('.focus-hero-media')
      const content = document.querySelector('.focus-assets')
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        gap: content.getBoundingClientRect().top - cover.getBoundingClientRect().bottom,
        media: [...content.querySelectorAll('.flow-media')].map((node) => {
          const rect = node.getBoundingClientRect()
          const [width, height] = getComputedStyle(node).aspectRatio.split('/').map(Number)
          return Math.abs(rect.width / rect.height - width / height)
        }),
      }
    })
    assert.equal(metrics.overflow, false)
    assert.ok(metrics.media.every((error) => error < .01), `Media ratio mismatch at ${width}x${height}`)
    assert.ok(metrics.gap >= 0 && metrics.gap < 50, `Project media is not below its cover at ${width}x${height}`)

    const second = category.projects[1]
    await page.getByRole('button', { name: '返回项目列表' }).click()
    await page.locator('.category-flow[data-project-view="list"]').waitFor()
    await page.getByRole('button', { name: second.title, exact: true }).click()
    await page.locator('.project-focus[data-mode="work"]').waitFor()
    assert.equal(await page.locator('.focus-assets .flow-media').count(), second.assets.length)
    assert.equal(await page.locator('.project-cover[aria-expanded="true"]').count(), 1)

    if (second.assets.length > 1) {
      await page.getByRole('button', { name: `放大查看${second.title}` }).first().click()
      assert.match(await page.locator('.lightbox-caption').innerText(), new RegExp(`01 / ${String(second.assets.length).padStart(2, '0')}`))
      await page.getByRole('button', { name: '下一张作品' }).click()
      assert.match(await page.locator('.lightbox-caption').innerText(), /02 \/ /)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.lightbox').count(), 0)
    }
    await page.getByRole('button', { name: '返回项目列表' }).click()
    await page.locator('.category-flow[data-project-view="list"]').waitFor()
    await page.getByRole('button', { name: '返回作品分类' }).click()
    await page.locator('.category-flow').waitFor({ state: 'detached' })
    await page.close()
    console.log(`${width}x${height}: project focus, ratio and viewer PASS`)
  }
  assert.deepEqual(errors, [])
  console.log('Project focus and browser errors PASS')
} finally {
  await browser.close()
}
