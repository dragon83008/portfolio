import test from 'node:test'
import assert from 'node:assert/strict'
import { introSections, coverAspect } from '../src/projectContent.js'

test('legacy introduction survives, explicit empty sections do not resurrect deleted text', () => {
  assert.deepEqual(introSections(), [])
  assert.deepEqual(introSections({ description: ' ' }), [])
  assert.equal(introSections({ description: '旧介绍\n第二段' })[0].body, '旧介绍\n第二段')
  assert.deepEqual(introSections({ description: '旧介绍', introSections: [] }), [])
  const blocks = [{ id: 'second', title: '思路', body: '正文' }, { id: 'first', title: '', body: '' }]
  assert.deepEqual(introSections({ description: '旧介绍', introSections: blocks }), blocks)
})

test('covers use known image or video dimensions without stretching', () => {
  assert.equal(coverAspect({ cover: '/portrait.webp', assets: [{ src: '/portrait.webp', width: 600, height: 1800 }] }), '600 / 1800')
  assert.equal(coverAspect({ cover: '/poster.webp', assets: [{ poster: '/poster.webp', width: 1920, height: 1080 }] }), '1920 / 1080')
  assert.equal(coverAspect({ cover: '/custom.webp', coverWidth: 1699, coverHeight: 926, assets: [] }), '1699 / 926')
  assert.equal(coverAspect({ cover: '/custom.webp', assets: [] }), '1 / 1')
})
