const rawCategories = [
  {
    id: 'commercial',
    title: '商业广告',
    cover: '/portfolio/covers/commercial.webp',
    projects: [
      { id: 'maoren-pop-up', title: '猫人线下快闪', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/commercial/maoren-pop-up.mp4', poster: '/portfolio/commercial/maoren-pop-up-poster.webp' }] },
      { id: 'haier-store', title: '海尔门店人物短片', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/commercial/haier-store.mp4', poster: '/portfolio/commercial/haier-store-poster.webp' }] },
      { id: 'hotel-promo', title: '酒店宣传片', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/commercial/hotel-promo.mp4', poster: '/portfolio/commercial/hotel-promo-poster.webp' }] },
      { id: 'retail-ads', title: '零售短视频广告系列', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/commercial/retail-ads.mp4', poster: '/portfolio/commercial/retail-ads-poster.webp' }] },
    ],
  },
  {
    id: 'brand',
    title: '品牌设计',
    cover: '/portfolio/covers/brand.webp',
    projects: [
      { id: 'grain-packaging', title: '谷物饮品包装', role: 'Independent Project', visibility: 'public', assets: [{ type: 'image', src: '/portfolio/brand/grain-packaging.webp' }] },
      { id: 'sanfu', title: '三福文创产品系列', role: 'Independent Project', visibility: 'review', assets: ['/portfolio/brand/sanfu-01.webp', '/portfolio/brand/sanfu-02.webp', '/portfolio/brand/sanfu-03.webp'].map((src) => ({ type: 'image', src })) },
      { id: 'cultural-center', title: '文化馆 VI 系统', role: 'Independent Project', visibility: 'review', assets: [{ type: 'image', src: '/portfolio/brand/cultural-center-vi.webp' }] },
      { id: 'ip-system', title: 'IP 形象与视觉系统', role: 'Independent Project', visibility: 'review', assets: [{ type: 'image', src: '/portfolio/brand/ip-system.webp' }] },
      { id: 'app-system', title: '数字品牌体验', role: 'Independent Project', visibility: 'public', assets: ['/portfolio/brand/ui-case-01.webp', '/portfolio/brand/ui-case-02.webp', '/portfolio/brand/ui-case-03.webp'].map((src) => ({ type: 'image', src })) },
      { id: 'wellness-ui', title: '心晴 UI 设计', role: 'Independent Project', visibility: 'public', assets: ['/portfolio/brand/wellness-ui-01.webp', '/portfolio/brand/wellness-ui-02.webp', '/portfolio/brand/wellness-ui-03.webp'].map((src) => ({ type: 'image', src })) },
    ],
  },
  {
    id: 'photography',
    title: '摄影作品',
    cover: '/portfolio/covers/photography.webp',
    projects: [
      { id: 'mountain', title: '雪山晨光', role: 'Independent Project', visibility: 'public', assets: [{ type: 'image', src: '/portfolio/photography/mountain.webp' }] },
      { id: 'city', title: '城市建筑', role: 'Independent Project', visibility: 'public', assets: [{ type: 'image', src: '/portfolio/photography/city.webp' }] },
      { id: 'blossom', title: '春日花影', role: 'Independent Project', visibility: 'public', assets: [{ type: 'image', src: '/portfolio/photography/blossom.webp' }] },
      { id: 'documentary-photo', title: '校园纪实', role: 'Independent Project', visibility: 'review', assets: [{ type: 'image', src: '/portfolio/photography/documentary.webp' }] },
    ],
  },
  {
    id: 'ai',
    title: 'AI 设计',
    cover: '/portfolio/covers/ai.webp',
    projects: [
      { id: 'fantasy-film', title: '幻想世界 AI 影像', role: 'Independent Project', visibility: 'public', assets: [{ type: 'video', src: '/portfolio/ai/fantasy-film.mp4', poster: '/portfolio/ai/fantasy-film-poster.webp' }] },
      { id: 'ai-trailer', title: 'AI 短片预告', role: 'Independent Project', visibility: 'public', assets: [{ type: 'video', src: '/portfolio/ai/ai-trailer.mp4', poster: '/portfolio/ai/ai-trailer-poster.webp' }] },
      { id: 'dunhuang', title: '敦煌千年之美', role: 'Independent Project', visibility: 'public', assets: [{ type: 'image', src: '/portfolio/ai/dunhuang.webp' }] },
      { id: 'ai-portraits', title: 'AI 人像研究', role: 'Independent Project', visibility: 'public', assets: ['/portfolio/ai/portrait-half.webp', '/portfolio/ai/portrait-close.webp'].map((src) => ({ type: 'image', src })) },
    ],
  },
  {
    id: 'video',
    title: '短视频',
    cover: '/portfolio/covers/video.webp',
    projects: [
      { id: 'atmospheric-documentary', title: '氛围纪录片', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/video/atmospheric-documentary.mp4', poster: '/portfolio/video/atmospheric-documentary-poster.webp' }] },
      { id: 'food-documentary', title: '食物与人物纪录片', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/video/food-documentary.mp4', poster: '/portfolio/video/food-documentary-poster.webp' }] },
      { id: 'narrative-film', title: '暗调叙事短片', role: 'Independent Project', visibility: 'review', assets: [{ type: 'video', src: '/portfolio/video/narrative-film.mp4', poster: '/portfolio/video/narrative-film-poster.webp' }] },
      { id: 'china-architecture', title: '中国建筑动态视觉', role: 'Independent Project', visibility: 'public', assets: [{ type: 'video', src: '/portfolio/video/china-architecture.mp4', poster: '/portfolio/video/china-architecture-poster.webp' }] },
      { id: 'wuhan-storyboard', title: '武汉味道 · 分镜策划', role: 'Independent Project', visibility: 'review', assets: [1, 2, 3, 4, 5].map((number) => ({ type: 'image', src: `/portfolio/video/wuhan-storyboard-${String(number).padStart(2, '0')}.webp` })) },
    ],
  },
]

const mediaSize = (src) => {
  if (src.includes('/brand/')) return [2400, 3394]
  if (src.includes('/photography/documentary')) return [2400, 3600]
  if (src.includes('/photography/')) return [2400, 1596]
  if (src.includes('/ai/dunhuang')) return [1024, 1536]
  if (src.includes('/ai/portrait-')) return [1408, 768]
  if (src.includes('/video/wuhan-storyboard-')) return [1521, 1076]
  if (src.endsWith('.mp4')) return [1280, 720]
  throw new Error(`Missing media dimensions: ${src}`)
}

export const portfolioCategories = rawCategories.map((category) => ({
  ...category,
  projects: category.projects.map((project) => ({
    ...project,
    assets: project.assets.map((asset) => {
      const [width, height] = mediaSize(asset.src)
      return { ...asset, width, height, orientation: height > width * 1.1 ? 'portrait' : width > height * 1.1 ? 'landscape' : 'square' }
    }),
  })),
}))
