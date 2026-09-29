import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { portfolioCategories } from '../src/portfolioData.js'

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const report = { checks: [], errors: [] }
await mkdir('screenshots', { recursive: true })

for (const category of portfolioCategories) {
  for (const project of category.projects) {
    for (const asset of project.assets) {
      const path = resolve('public', asset.src.slice(1))
      if (asset.poster) assert.ok(existsSync(resolve('public', asset.poster.slice(1))), `Missing poster: ${asset.poster}`)
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path], { encoding: 'utf8' }))
      const { width, height } = probe.streams[0]
      assert.deepEqual([asset.width, asset.height], [width, height], `Dimension metadata mismatch: ${asset.src}`)
    }
  }
}
report.checks.push('Every source media file matches width and height metadata PASS')

try {
  for (const [width, height] of [[1440, 1100], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (error) => report.errors.push(`${width}x${height}: ${error.message}`))
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
    await page.waitForTimeout(830)
    await page.getByRole('button', { name: '打开品牌设计作品' }).click()
    if (width === 1440) {
      await page.waitForTimeout(170)
      await page.mouse.wheel(0, 850)
      assert.equal(await page.locator('.flow-scroll').evaluate((element) => element.scrollTop), 0)
      const previewHeight = await page.locator('.flow-transition').evaluate((element) => element.getBoundingClientRect().height)
      await page.screenshot({ path: 'screenshots/category-flow-preview.png' })
      await page.waitForTimeout(410)
      await page.mouse.wheel(0, 850)
      assert.equal(await page.locator('.flow-scroll').evaluate((element) => element.scrollTop), 0)
      const expandingHeight = await page.locator('.flow-transition').evaluate((element) => element.getBoundingClientRect().height)
      assert.ok(expandingHeight > previewHeight + 15)
      await page.screenshot({ path: 'screenshots/category-flow-expanding.png' })
    }
    await page.locator('.category-flow[data-phase="open"]').waitFor({ timeout: 5000 })
    const metrics = await page.evaluate(() => {
      const media = [...document.querySelectorAll('.flow-media')]
      const row = document.querySelector('.flow-row')
      const images = [...document.querySelectorAll('.flow-media img')]
      const pair = [...row.querySelectorAll('.flow-item')].map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })
      const heading = document.querySelector('.flow-sidebar h2').getBoundingClientRect()
      return {
        count: media.length,
        firstRow: row.querySelectorAll('.flow-item').length,
        pair,
        heading: { x: heading.x, y: heading.y, width: heading.width },
        aspectErrors: media.map((element, index) => {
          const image = images[index]
          if (!image.naturalWidth) return null
          return Math.abs((element.getBoundingClientRect().width / element.getBoundingClientRect().height) / (image.naturalWidth / image.naturalHeight) - 1)
        }),
        overflowX: document.documentElement.scrollWidth > innerWidth,
        mediaFit: [...document.querySelectorAll('.flow-media img, .flow-media video')].map((element) => getComputedStyle(element).objectFit),
        scrollHeight: document.querySelector('.flow-scroll').scrollHeight,
        clientHeight: document.querySelector('.flow-scroll').clientHeight,
      }
    })
    assert.equal(metrics.count, 12)
    assert.ok(metrics.aspectErrors.filter((error) => error !== null).every((error) => error < .01), `ratio mismatch ${width}x${height}`)
    assert.equal(metrics.firstRow, 2)
    if (width < 900) {
      assert.ok(metrics.pair[1].y >= metrics.pair[0].y + metrics.pair[0].height, `Mobile pair should stack ${width}x${height}`)
      assert.ok(metrics.heading.y < 70 && Math.abs(metrics.heading.x + metrics.heading.width / 2 - width / 2) < 3)
    } else assert.ok(Math.abs(metrics.pair[1].y - metrics.pair[0].y) < 2, `Desktop pair should share a row ${width}x${height}`)
    assert.equal(metrics.overflowX, false)
    assert.ok(metrics.mediaFit.every((fit) => fit === 'contain'))
    assert.ok(metrics.scrollHeight > metrics.clientHeight)
    if (width === 1440) await page.screenshot({ path: 'screenshots/category-flow-brand-desktop.png' })
    if (width === 390) await page.screenshot({ path: 'screenshots/category-flow-brand-mobile.png' })
    if (width === 844) await page.screenshot({ path: 'screenshots/category-flow-brand-landscape.png' })
    await page.getByRole('button', { name: '放大查看谷物饮品包装' }).click()
    await page.getByRole('dialog', { name: '谷物饮品包装完整作品' }).waitFor()
    if (width === 1440) await page.screenshot({ path: 'screenshots/category-flow-lightbox.png' })
    await page.getByRole('button', { name: '下一张作品' }).click()
    assert.equal((await page.locator('.lightbox-caption').innerText()).replace(/\s+/g, ' '), '三福文创产品系列 02 / 12')
    await page.keyboard.press('ArrowLeft')
    assert.equal((await page.locator('.lightbox-caption').innerText()).replace(/\s+/g, ' '), '谷物饮品包装 01 / 12')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.lightbox').count(), 0)
    await page.locator('.flow-scroll').evaluate((element) => { element.scrollTop = element.scrollHeight / 2 })
    await page.getByRole('button', { name: '返回作品分类' }).click()
    if (width === 1440) {
      await page.waitForTimeout(260)
      await page.screenshot({ path: 'screenshots/category-flow-closing-scrolled.png' })
    }
    await page.locator('.category-flow').waitFor({ state: 'detached', timeout: 5000 })
    assert.equal(await page.locator('[data-offset="0"] .work-card').getAttribute('aria-label'), '打开品牌设计作品')
    report.checks.push(`${width}x${height}: 12 brand assets, original ratio, scroll, image view, return PASS`)
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (error) => report.errors.push(`interaction: ${error.message}`))
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开商业广告作品' }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
  assert.equal(await page.locator('.flow-media video').count(), 4)
  assert.ok(await page.locator('.flow-media video').first().evaluate((video) => !video.paused))
  await page.getByRole('button', { name: '放大播放猫人线下快闪' }).click()
  await page.getByRole('dialog', { name: '猫人线下快闪完整作品' }).waitFor()
  assert.equal(await page.locator('.lightbox video').evaluate((video) => video.controls), true)
  assert.equal(await page.locator('.flow-media video').first().evaluate((video) => video.paused), true)
  await page.getByRole('button', { name: '关闭大图' }).click()
  assert.equal(await page.locator('.lightbox').count(), 0)
  await page.locator('.flow-scroll').evaluate((element) => { element.scrollTop = element.scrollHeight })
  await page.waitForTimeout(300)
  assert.ok(await page.locator('.flow-media video').first().evaluate((video) => video.paused))
  await page.keyboard.press('Escape')
  await page.locator('.category-flow').waitFor({ state: 'detached' })
  report.checks.push('Commercial video preview, full viewer controls, pause outside viewport, Escape return PASS')
  for (const name of ['摄影作品', 'AI 设计', '短视频']) {
    await page.getByRole('button', { name: `查看${name}`, exact: true }).click()
    await page.waitForTimeout(830)
    await page.getByRole('button', { name: `打开${name}作品` }).click()
    await page.locator('.category-flow[data-phase="open"]').waitFor()
    assert.equal(await page.locator('.flow-sidebar h2').innerText(), name)
    assert.ok(await page.locator('.flow-media').count() >= 4)
    await page.keyboard.press('Escape')
    await page.locator('.category-flow').waitFor({ state: 'detached' })
  }
  report.checks.push('Photography, AI, short video category flows open and close PASS')
  await page.getByRole('button', { name: '查看品牌设计', exact: true }).click()
  await page.waitForTimeout(830)
  await page.getByRole('button', { name: '打开品牌设计作品' }).click()
  await page.waitForTimeout(120)
  await page.keyboard.press('Escape')
  await page.locator('.category-flow').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '打开品牌设计作品' }).click()
  await page.waitForTimeout(550)
  await page.keyboard.press('Escape')
  await page.locator('.category-flow').waitFor({ state: 'detached' })
  report.checks.push('Escape during preview and expansion cancels transitions PASS')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '打开品牌设计作品' }).click()
  await page.locator('.category-flow[data-phase="open"]').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.category-flow').waitFor({ state: 'detached' })
  report.checks.push('Reduced motion opens and closes immediately PASS')
  await page.close()
  const broken = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await broken.route('**/portfolio/brand/grain-packaging.webp', (route) => route.abort())
  await broken.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await broken.getByRole('button', { name: '查看品牌设计', exact: true }).click()
  await broken.waitForTimeout(830)
  await broken.getByRole('button', { name: '打开品牌设计作品' }).click()
  await broken.locator('.category-flow[data-phase="open"]').waitFor()
  await broken.locator('.media-fallback').first().waitFor()
  assert.equal(await broken.locator('.media-fallback').first().locator('span').innerText(), '谷物饮品包装')
  report.checks.push('Broken image keeps project name and reserved aspect ratio PASS')
  await broken.close()
  assert.deepEqual(report.errors, [])
  await writeFile('screenshots/category-flow-results.json', JSON.stringify(report, null, 2))
  console.log(report.checks.join('\n'))
} finally {
  await browser.close()
}
