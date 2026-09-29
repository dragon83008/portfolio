import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Images, Info, Maximize2, Minimize2, MessageCircle, UserRound } from 'lucide-react'
import MotionTitle from './MotionTitle.jsx'
import { coverAspect, coverDimensions, introSections } from './projectContent.js'
import ProfilePanel from './ProfilePanel.jsx'
import { profile } from './profileData.js'
import './App.css'

const wrap = (value, length = 5) => ((value % length) + length) % length
const offsetFor = (index, active, length = 5) => wrap(index - active + 2, length) - 2
const DURATION = 500
const tiltPointer = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')

function trapTab(event, root) {
  if (event.key !== 'Tab' || !root) return
  const controls = [...root.querySelectorAll('button, a[href], video[controls]')].filter((node) => !node.disabled && !node.closest('[inert]') && node.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (!first) return
  if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus() }
}

function TiltSurface({ children, enabled = true }) {
  const hostRef = useRef(null)
  const frameRef = useRef(0)
  const reset = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    const surface = hostRef.current?.firstElementChild
    if (!surface) return
    surface.style.setProperty('--tilt-x', '0deg')
    surface.style.setProperty('--tilt-y', '0deg')
    surface.style.setProperty('--tilt-lift', '0px')
    surface.style.setProperty('--tilt-scale', '1')
  }, [])
  useEffect(() => {
    if (!enabled) reset()
  }, [enabled, reset])
  useEffect(() => {
    tiltPointer.addEventListener('change', reset)
    return () => { tiltPointer.removeEventListener('change', reset); cancelAnimationFrame(frameRef.current) }
  }, [reset])
  const move = (event) => {
    if (!enabled || !tiltPointer.matches || event.pointerType !== 'mouse') return
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const surface = host.firstElementChild
      if (!surface) return
      surface.style.setProperty('--tilt-x', `${((0.5 - y) * 6).toFixed(2)}deg`)
      surface.style.setProperty('--tilt-y', `${((x - 0.5) * 6).toFixed(2)}deg`)
      surface.style.setProperty('--tilt-lift', '-3px')
      surface.style.setProperty('--tilt-scale', '1.015')
    })
  }
  return <div ref={hostRef} className="tilt-host" onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}><div className="tilt-surface">{children}</div></div>
}

function GalleryMedia({ asset, title, onOpen, observeVideo = false, suspended = false }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef(null)
  useEffect(() => {
    if (!observeVideo || asset.type !== 'video' || failed) return
    const video = videoRef.current
    if (suspended) { video.pause(); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= .55) video.play().catch(() => {})
      else video.pause()
    }, { threshold: [.55] })
    observer.observe(video)
    return () => { observer.disconnect(); video.pause() }
  }, [asset, observeVideo, failed, suspended])
  if (failed) return <div className="media-fallback"><span>{title}</span><small>作品暂时无法加载</small></div>
  if (asset.type === 'video') return <>
    <video ref={videoRef} src={asset.src} poster={asset.poster} autoPlay={!observeVideo && !suspended} muted={observeVideo} loop={observeVideo} playsInline controls={!observeVideo} preload="metadata" onError={() => setFailed(true)} />
    {observeVideo && <button type="button" className="flow-video-open" aria-label={`放大播放${title}`} onClick={onOpen}><Maximize2 size={17} strokeWidth={1.7} /></button>}
  </>
  return <button type="button" className="flow-image-button" aria-label={`放大查看${title}`} onClick={onOpen}><img src={asset.src} alt={`${title}作品`} loading="lazy" onError={() => setFailed(true)} /></button>
}

function groupAssets(entries) {
  const rows = []
  for (const entry of entries) {
    const last = rows.at(-1)
    if (entry.asset.orientation === 'portrait' && last?.length === 1 && last[0].asset.orientation === 'portrait') last.push(entry)
    else rows.push([entry])
  }
  return rows
}

function ProjectCover({ project, expanded, onClick, enabled }) {
  const [failed, setFailed] = useState(false)
  const cover = project.cover || project.assets[0]?.poster || project.assets[0]?.src
  return <button type="button" className="project-cover" aria-expanded={expanded} aria-controls={expanded ? `project-focus-${project.id}` : undefined} onClick={onClick}>
    <div className="project-cover-media" style={{ aspectRatio: coverAspect(project) }}><TiltSurface enabled={enabled}>{cover && !failed ? <img src={cover} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="project-cover-fallback">{project.title}</span>}</TiltSurface></div>
    <span className="project-cover-title">{project.title}</span>
  </button>
}

function Lightbox({ entries, index, onClose, onChange }) {
  const entry = entries[index]
  const rootRef = useRef(null)
  const closeRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    return () => { requestAnimationFrame(() => previous?.focus({ preventScroll: true })) }
  }, [])
  useEffect(() => {
    closeRef.current?.focus()
    const key = (event) => {
      trapTab(event, rootRef.current)
      if (event.key === 'Escape') { event.stopImmediatePropagation(); onClose() }
      if (event.key === 'ArrowLeft') onChange(wrap(index - 1, entries.length))
      if (event.key === 'ArrowRight') onChange(wrap(index + 1, entries.length))
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [entries.length, index, onChange, onClose])
  return <div ref={rootRef} className="lightbox" role="dialog" aria-modal="true" aria-label={`${entry.title}完整作品`} onClick={onClose}>
    <button ref={closeRef} type="button" className="lightbox-close icon-button" aria-label="关闭大图" title="返回作品" onClick={onClose}><Minimize2 size={19} /></button>
    <button type="button" className="lightbox-arrow" aria-label="上一张作品" onClick={(event) => { event.stopPropagation(); onChange(wrap(index - 1, entries.length)) }}><ChevronLeft size={22} /></button>
    <div className="lightbox-content" onClick={(event) => event.stopPropagation()} key={entry.asset.src}><GalleryMedia asset={entry.asset} title={entry.title} /></div>
    <button type="button" className="lightbox-arrow" aria-label="下一张作品" onClick={(event) => { event.stopPropagation(); onChange(wrap(index + 1, entries.length)) }}><ChevronRight size={22} /></button>
    <p className="lightbox-caption">{entry.title} <span>{String(index + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</span></p>
  </div>
}

function CategoryFlow({ category, phase, onClose, closeRef }) {
  const rootRef = useRef(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projectView, setProjectView] = useState('list')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [projectTransition, setProjectTransition] = useState(null)
  const viewRef = useRef('list')
  const transitionRef = useRef(null)
  const animationRef = useRef(null)
  const timersRef = useRef([])
  const workPaneRef = useRef(null)
  const heroRef = useRef(null)
  const restoreHeroFocusRef = useRef(false)
  const introHeadingRef = useRef(null)
  const projectBackRef = useRef(null)
  const listRef = useRef(null)
  const [scrollProjectId, setScrollProjectId] = useState(category.projects[0]?.id)
  const scrollProjectRef = useRef(category.projects[0]?.id)
  const activeProject = category.projects.find((project) => project.id === selectedProjectId)
  const sections = introSections(activeProject).filter((section) => section.body.trim())
  const hasDescription = sections.length > 0
  const titleProject = activeProject || category.projects.find((project) => project.id === scrollProjectId) || category.projects[0]
  const entries = activeProject?.assets.map((asset) => ({ id: asset.id, title: activeProject.title, asset })) || []
  const lightboxOpen = lightboxIndex !== null && Boolean(entries[lightboxIndex])
  useEffect(() => {
    const list = listRef.current
    if (!list || phase !== 'open' || projectView !== 'list') return
    let frame = 0
    const cards = [...list.querySelectorAll('[data-project-id]')]
    const update = () => {
      const center = innerHeight / 2
      const distances = cards.map((node) => {
        const rect = node.getBoundingClientRect()
        return { id: node.dataset.projectId, distance: Math.abs((rect.top + rect.bottom) / 2 - center) }
      }).sort((a, b) => a.distance - b.distance)
      const closest = distances[0]
      const current = distances.find((entry) => entry.id === scrollProjectRef.current)
      // Hysteresis prevents title flicker near the boundary between covers.
      if (closest && (!current || closest.distance + 48 < current.distance)) {
        scrollProjectRef.current = closest.id
        setScrollProjectId(closest.id)
      }
    }
    const scroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) entry.target.dataset.revealed = 'true'
    }, { root: list, threshold: 0, rootMargin: '0px 0px -24px 0px' })
    cards.forEach((card) => observer.observe(card))
    scroll()
    list.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', scroll)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); list.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll) }
  }, [phase, projectView, category.projects])
  const setView = (view) => { viewRef.current = view; setProjectView(view) }
  const later = (callback, delay) => { timersRef.current.push(window.setTimeout(callback, delay)) }
  const focusProject = (project) => {
    if (phase !== 'open' || viewRef.current !== 'list') return
    const source = document.querySelector(`[data-project-id="${project.id}"] .project-cover-media`)
    if (!source) return
    const from = source.getBoundingClientRect()
    const cover = project.cover || project.assets[0]?.poster || project.assets[0]?.src || category.cover
    setSelectedProjectId(project.id)
    setView('entering')
    setProjectTransition({ src: cover, rect: from })
    later(() => requestAnimationFrame(() => {
      if (viewRef.current !== 'entering') return
      const node = transitionRef.current
      const target = document.querySelector('.focus-hero-media')?.getBoundingClientRect()
      if (!node || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setProjectTransition(null); setView('work'); projectBackRef.current?.focus(); return
      }
      const animation = node.animate([
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '28px' },
        { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, borderRadius: '28px' },
      ], { duration: 760, easing: 'cubic-bezier(.22,.72,.16,1)', fill: 'forwards' })
      animationRef.current = animation
      animation.onfinish = () => {
        if (viewRef.current !== 'entering') return
        animationRef.current = null; setProjectTransition(null); setView('work'); projectBackRef.current?.focus()
      }
    }), 30)
  }
  const showInfo = () => {
    if (viewRef.current !== 'work' || !hasDescription) return
    setView('info-entering')
    later(() => {
      if (viewRef.current !== 'info-entering') return
      setView('info')
      requestAnimationFrame(() => introHeadingRef.current?.focus({ preventScroll: true }))
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 430)
  }
  const showWork = () => {
    if (viewRef.current !== 'info') return
    restoreHeroFocusRef.current = true
    setView('info-leaving')
    later(() => {
      if (viewRef.current !== 'info-leaving') return
      setView('work')
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 430)
  }
  useEffect(() => {
    if (projectView !== 'work' || !restoreHeroFocusRef.current) return
    restoreHeroFocusRef.current = false
    heroRef.current?.focus({ preventScroll: true })
  }, [projectView])
  const returnToList = () => {
    if (!['work', 'info'].includes(viewRef.current)) return
    const leavingInfo = viewRef.current === 'info'
    const source = workPaneRef.current?.querySelector('.focus-hero-media')
    const from = source?.getBoundingClientRect()
    const target = document.querySelector(`[data-project-id="${selectedProjectId}"] .project-cover-media`)?.getBoundingClientRect()
    const visibleHero = from && from.bottom > 0 && from.top < innerHeight
    const animate = !leavingInfo && visibleHero && target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setView('leaving')
    const finish = () => {
      if (viewRef.current !== 'leaving') return
      animationRef.current = null; setProjectTransition(null); setSelectedProjectId(null); setView('list')
      requestAnimationFrame(() => document.querySelector(`[data-project-id="${selectedProjectId}"] .project-cover`)?.focus({ preventScroll: true }))
    }
    if (!animate) { later(finish, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : leavingInfo ? 430 : 300); return }
    setProjectTransition({ src: activeProject.cover || activeProject.assets[0]?.poster || activeProject.assets[0]?.src || category.cover, rect: from })
    requestAnimationFrame(() => {
      if (viewRef.current !== 'leaving' || !transitionRef.current) return
      const animation = transitionRef.current.animate([
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '28px' },
        { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, borderRadius: '28px' },
      ], { duration: 640, easing: 'cubic-bezier(.22,.72,.16,1)', fill: 'forwards' })
      animationRef.current = animation
      animation.onfinish = finish
    })
  }
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    animationRef.current?.cancel()
  }, [])
  useEffect(() => {
    if (!selectedProjectId || activeProject) return
    const frame = requestAnimationFrame(() => {
      animationRef.current?.cancel()
      setSelectedProjectId(null)
      setProjectTransition(null)
      setView('list')
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedProjectId, activeProject])
  useEffect(() => {
    const key = (event) => {
      if (!lightboxOpen && phase === 'open') trapTab(event, rootRef.current)
      if (event.key !== 'Escape' || lightboxOpen) return
      event.preventDefault()
      if (viewRef.current === 'info') showWork()
      else if (viewRef.current === 'work') returnToList()
      else if (viewRef.current === 'list') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  return <section ref={rootRef} className="category-flow" data-phase={phase} data-project-view={projectView} data-lightbox-open={lightboxOpen} role="dialog" aria-modal="true" aria-label={`${category.title}作品`}>
    <aside className="flow-sidebar" inert={phase !== 'open' || lightboxOpen || !['list', 'work', 'info'].includes(projectView)}>
      <MotionTitle title={titleProject?.title || category.title} subtitle={category.title} />
      <div className="flow-sidebar-actions">
        {projectView === 'list' ? <button ref={closeRef} className="flow-back icon-button" type="button" aria-label="返回作品分类" title="返回作品分类" onClick={onClose}><Minimize2 size={19} /></button> : <>
          <button ref={projectBackRef} className="flow-back icon-button" type="button" aria-label={projectView === 'info' ? '返回项目作品' : '返回项目列表'} title={projectView === 'info' ? '返回项目作品' : '返回项目列表'} onClick={projectView === 'info' ? showWork : returnToList}><Minimize2 size={19} /></button>
          {hasDescription && (projectView === 'info' ? <button className="icon-button" type="button" aria-label="查看作品" onClick={showWork}><Images size={18} /></button> : <button className="icon-button" type="button" aria-label="查看项目介绍" onClick={showInfo}><Info size={18} /></button>)}
        </>}
      </div>
    </aside>
    <div ref={listRef} className="flow-scroll project-list" inert={phase !== 'open' || projectView !== 'list' || lightboxOpen}>
      <div className="flow-column">
        {category.projects.length === 0 && <p className="flow-empty">这个分类暂时没有已发布作品。</p>}
        {category.projects.map((project, index) => <div className="project-group" key={project.id} data-project-id={project.id} data-revealed={index === 0 ? 'true' : undefined} style={{ '--cover-ratio': coverDimensions(project).width / coverDimensions(project).height }}><ProjectCover project={project} expanded={project.id === selectedProjectId} enabled={phase === 'open' && projectView === 'list' && !lightboxOpen} onClick={() => focusProject(project)} /></div>)}
      </div>
    </div>
    {activeProject && <div id={`project-focus-${activeProject.id}`} className="project-focus" data-mode={projectView}>
      <div ref={workPaneRef} className="focus-pane project-work" inert={projectView !== 'work' || lightboxOpen} aria-hidden={projectView !== 'work'}>
        <div className="focus-column">
          <button ref={heroRef} type="button" className="focus-hero" disabled={!hasDescription} aria-label={hasDescription ? `查看${activeProject.title}的项目介绍` : `${activeProject.title}封面`} onClick={showInfo}>
            <span className="focus-hero-media" style={{ aspectRatio: coverAspect(activeProject), '--cover-ratio': coverDimensions(activeProject).width / coverDimensions(activeProject).height }}><img src={activeProject.cover || activeProject.assets[0]?.poster || activeProject.assets[0]?.src || category.cover} alt={activeProject.title} onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /></span>
          </button>
          <div className="focus-assets" aria-label={`${activeProject.title}作品内容`}>
            {groupAssets(entries).map((row) => <div className={`flow-row ${row.length === 2 ? 'flow-row-pair' : ''} ${row.length === 1 && row[0].asset.orientation === 'portrait' ? 'flow-row-single-portrait' : ''}`} key={row[0].id}>
              {row.map((entry) => <div className="flow-item" key={entry.id}>
                <div className="flow-media" style={{ aspectRatio: `${entry.asset.width} / ${entry.asset.height}` }}><TiltSurface enabled={projectView === 'work' && !lightboxOpen}><GalleryMedia asset={entry.asset} title={entry.title} onOpen={() => setLightboxIndex(entries.findIndex((item) => item.id === entry.id))} observeVideo suspended={projectView !== 'work' || lightboxOpen} /></TiltSurface></div>
              </div>)}
            </div>)}
          </div>
        </div>
      </div>
      {hasDescription && <article className="focus-pane project-intro" inert={projectView !== 'info'} aria-hidden={projectView !== 'info'}>
        {sections.map((section, index) => <section className="intro-section" key={section.id}>
          <h3 ref={index === 0 ? introHeadingRef : undefined} tabIndex={index === 0 ? -1 : undefined} className="project-intro-label">{section.title || '项目介绍'}</h3>
          <p>{section.body}</p>
        </section>)}
        <button type="button" className="project-intro-return" onClick={showWork}><Images size={17} /> 查看作品</button>
      </article>}
    </div>}
    {projectTransition && <div ref={transitionRef} className="project-transition" style={{ left: projectTransition.rect.left, top: projectTransition.rect.top, width: projectTransition.rect.width, height: projectTransition.rect.height }}><img src={projectTransition.src} alt="" /></div>}
    {lightboxOpen && <Lightbox entries={entries} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} />}
  </section>
}

function App({ works, preview = false }) {
  const [profileMode, setProfileMode] = useState(null)
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [intro, setIntro] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [selection, setSelection] = useState({ active: 0, target: 0, reset: [] })
  const [caption, setCaption] = useState({ index: 0, visible: true })
  const [announced, setAnnounced] = useState(0)
  const [moving, setMoving] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(null)
  const [flowPhase, setFlowPhase] = useState('closed')
  const [transitionImage, setTransitionImage] = useState(null)
  const galleryOpen = useRef(false)
  const flowPhaseRef = useRef('closed')
  const transitionRef = useRef(null)
  const transitionAnimation = useRef(null)
  const closeRef = useRef(null)
  const flowTimers = useRef([])
  const motion = useRef({ active: 0, target: 0, busy: false, pending: null })
  const timers = useRef(new Set())
  const gesture = useRef({ sum: 0, last: 0, consumed: false, touch: null })
  const closeProfile = useCallback(() => { setProfileMode(null); galleryOpen.current = false }, [])
  const openProfile = (mode) => { galleryOpen.current = true; setProfileMode(mode) }

  const setPhase = useCallback((phase) => { flowPhaseRef.current = phase; setFlowPhase(phase) }, [])
  const laterFlow = useCallback((fn, delay) => {
    const timer = window.setTimeout(fn, delay)
    flowTimers.current.push(timer)
  }, [])
  const clearFlowTimers = useCallback(() => { flowTimers.current.forEach(clearTimeout); flowTimers.current = [] }, [])
  const openGallery = useCallback((index) => {
    if (flowPhaseRef.current !== 'closed') return
    const category = works[index]
    const firstAsset = category.projects[0]?.assets[0]
    const heroSource = category.projects[0]?.cover || firstAsset?.poster || firstAsset?.src || category.cover
    const card = document.querySelector(`[data-work="${index}"] .work-media`)
    if (!card) return
    const from = card.getBoundingClientRect()
    galleryOpen.current = true
    setGalleryIndex(index)
    setPhase('previewing')
    setTransitionImage({ src: category.cover, nextSrc: heroSource, showNext: false, rect: from })
    const reducedMotion = reduced.current
    laterFlow(() => {
      setPhase('expanding')
      requestAnimationFrame(() => {
        if (flowPhaseRef.current !== 'expanding') return
        const node = transitionRef.current
        const target = document.querySelector('.project-cover-media')?.getBoundingClientRect()
        if (!node || !target || reducedMotion) {
          setTransitionImage(null); setPhase('open'); closeRef.current?.focus(); return
        }
        const animation = node.animate([
          { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: '32px' },
          { left: target.left + 'px', top: target.top + 'px', width: target.width + 'px', height: target.height + 'px', borderRadius: '30px' },
        ], { duration: 880, easing: 'cubic-bezier(.22,.72,.16,1)', fill: 'forwards' })
        transitionAnimation.current = animation
        laterFlow(() => setTransitionImage((current) => current ? { ...current, showNext: true } : current), 650)
        animation.onfinish = () => {
          if (flowPhaseRef.current !== 'expanding') return
          transitionAnimation.current = null; setTransitionImage(null); setPhase('open'); closeRef.current?.focus()
        }
      })
    }, reducedMotion ? 0 : 40)
  }, [laterFlow, setPhase, works])
  const closeGallery = useCallback(() => {
    if (flowPhaseRef.current === 'closed' || flowPhaseRef.current === 'closing') return
    clearFlowTimers()
    transitionAnimation.current?.cancel()
    transitionAnimation.current = null
    const index = galleryIndex
    const category = works[index]
    const target = document.querySelector(`[data-work="${index}"] .work-media`)?.getBoundingClientRect()
    const firstVisible = [...document.querySelectorAll('.project-cover-media, .flow-media')].find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < innerHeight
    })
    const from = (firstVisible || document.querySelector('.project-cover-media'))?.getBoundingClientRect()
    setPhase('closing')
    if (!target || !from || reduced.current) {
      setTransitionImage(null); setGalleryIndex(null); setPhase('closed'); galleryOpen.current = false
      requestAnimationFrame(() => document.querySelector(`[data-work="${index}"] .work-card`)?.focus())
      return
    }
    const visibleImage = firstVisible?.querySelector('img')
    const visibleVideo = firstVisible?.querySelector('video')
    const fromSource = visibleImage?.currentSrc || visibleVideo?.poster || category.projects[0]?.cover || category.cover
    setTransitionImage({ src: fromSource, nextSrc: category.cover, showNext: false, rect: from })
    requestAnimationFrame(() => {
      const node = transitionRef.current
      if (!node || flowPhaseRef.current !== 'closing') return
      const animation = node.animate([
        { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: '30px' },
        { left: target.left + 'px', top: target.top + 'px', width: target.width + 'px', height: target.height + 'px', borderRadius: '32px' },
      ], { duration: 700, easing: 'cubic-bezier(.22,.72,.16,1)', fill: 'forwards' })
      transitionAnimation.current = animation
      laterFlow(() => setTransitionImage((current) => current ? { ...current, showNext: true } : current), 490)
      animation.onfinish = () => {
        transitionAnimation.current = null
        setTransitionImage(null); setGalleryIndex(null); setPhase('closed'); galleryOpen.current = false
        requestAnimationFrame(() => document.querySelector(`[data-work="${index}"] .work-card`)?.focus())
      }
    })
  }, [clearFlowTimers, galleryIndex, laterFlow, setPhase, works])
  useEffect(() => () => clearFlowTimers(), [clearFlowTimers])
  const select = useCallback((index) => {
    setIntro(false)
    const state = motion.current
    const next = wrap(index, works.length)
    state.target = next
    setSelection((current) => ({ ...current, target: next }))
    if (state.busy && !reduced.current) { state.pending = next === state.active ? null : next; return }
    const later = (fn, delay) => {
      const timer = window.setTimeout(() => { timers.current.delete(timer); fn() }, delay)
      timers.current.add(timer)
    }
    const run = (target) => {
      if (target === state.active) return
      const previous = state.active
      const reset = works.flatMap((_, i) => Math.abs(offsetFor(i, target, works.length) - offsetFor(i, previous, works.length)) > 2 ? [i] : [])
      state.active = target
      state.busy = !reduced.current
      setMoving(state.busy)
      setSelection({ active: target, target: state.target, reset })
      if (reduced.current) { setCaption({ index: target, visible: true }); setAnnounced(target); return }
      setCaption((current) => ({ ...current, visible: false }))
      later(() => setCaption({ index: target, visible: true }), DURATION * .7)
      later(() => {
        state.busy = false
        setMoving(false)
        setAnnounced(target)
        const pending = state.pending
        state.pending = null
        if (pending !== null && pending !== state.active) run(pending)
      }, DURATION)
    }
    run(next)
  }, [works])

  useEffect(() => {
    const scheduledTimers = timers.current
    const introTimer = window.setTimeout(() => setIntro(false), 850)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const preference = () => {
      reduced.current = media.matches
      if (!media.matches) return
      scheduledTimers.forEach(clearTimeout); scheduledTimers.clear()
      const state = motion.current
      state.active = state.target; state.pending = null; state.busy = false
      setIntro(false); setMoving(false)
      setSelection({ active: state.target, target: state.target, reset: [] })
      setCaption({ index: state.target, visible: true }); setAnnounced(state.target)
    }
    const wheel = (event) => {
      if (galleryOpen.current || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if (document.documentElement.scrollHeight > window.innerHeight + 2) return
      event.preventDefault()
      const now = performance.now()
      const state = gesture.current
      if (now - state.last > 180 || Math.sign(event.deltaY) !== Math.sign(state.sum)) { state.sum = 0; state.consumed = false }
      state.last = now
      state.sum += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      if (state.consumed || Math.abs(state.sum) < 40) return
      state.consumed = true
      select(motion.current.target + Math.sign(state.sum))
    }
    const key = (event) => {
      if (galleryOpen.current || event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return
      const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
      if (!direction) return
      event.preventDefault()
      if (!event.repeat) select(motion.current.target + direction)
    }
    media.addEventListener('change', preference)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => {
      clearTimeout(introTimer); scheduledTimers.forEach(clearTimeout); scheduledTimers.clear()
      media.removeEventListener('change', preference); window.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key)
    }
  }, [select])

  return <>
    {preview && <a className="preview-exit" href="/admin">{preview === 'cover' ? '首页封面预览' : '草稿预览'} · 返回管理</a>}
    <main className={`stage ${intro ? 'is-entering' : ''}`} data-moving={moving} data-flow-open={galleryIndex !== null} inert={galleryIndex !== null || profileMode !== null} onTouchStart={(event) => {
      if (galleryOpen.current || event.touches.length !== 1) { gesture.current.touch = null; return }
      const touch = event.touches[0]; gesture.current.touch = { x: touch.clientX, y: touch.clientY }
    }} onTouchEnd={(event) => {
      const start = gesture.current.touch; gesture.current.touch = null
      if (!start || galleryOpen.current || document.documentElement.scrollHeight > window.innerHeight + 2) return
      const touch = event.changedTouches[0]; const dy = start.y - touch.clientY
      if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(start.x - touch.clientX)) select(motion.current.target + Math.sign(dy))
    }} onTouchCancel={() => { gesture.current.touch = null }}>
      <section className="identity-panel" aria-label="Designer profile">
        <div className="identity-copy"><h1>段小龙</h1><p>Visual Designer / AI Designer</p></div>
        <div className="identity-actions">
          <span className="action-wrap"><button type="button" aria-disabled={!profile.approved && preview !== 'draft'} aria-label="关于我" aria-describedby="about-hint" onClick={() => (profile.approved || preview === 'draft') && openProfile('about')}><UserRound size={15} strokeWidth={1.7} /></button><span className="tooltip" id="about-hint" role="tooltip">{profile.approved || preview === 'draft' ? '关于我' : '个人介绍待确认'}</span></span>
          {(profile.email || profile.wechat) && <span className="action-wrap"><button type="button" aria-label="联系我" onClick={() => openProfile('contact')}><MessageCircle size={15} strokeWidth={1.7} /></button><span className="tooltip" role="tooltip">联系我</span></span>}
        </div>
      </section>
      <section className="work-stage" aria-label="作品集">
        <ul className="work-stack">
          {works.map((work, index) => {
            const offset = offsetFor(index, selection.active, works.length)
            return <li key={work.id} data-work={index} data-offset={offset} className={`work-item ${selection.reset.includes(index) ? 'reset-slot' : ''}`} aria-hidden={offset !== 0}>
              <button type="button" className="work-card" tabIndex={offset === 0 ? 0 : -1} aria-label={`打开${work.title}作品`} onClick={() => offset === 0 && openGallery(index)}><div className="work-media cover-standard"><TiltSurface enabled={offset === 0 && !moving && !intro && galleryIndex === null}><img src={work.cover} alt={`${work.title}封面`} draggable="false" /></TiltSurface></div></button>
            </li>
          })}
        </ul>
        <p className={`work-caption ${caption.visible ? '' : 'caption-hidden'}`} aria-hidden="true">{works[caption.index].title}</p>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{works[announced].title}</span>
      </section>
      <nav className="work-dots" aria-label="作品分类">
        {works.map((work, index) => <button type="button" key={work.id} aria-label={`查看${work.title}`} aria-current={index === selection.target ? 'true' : undefined} onClick={() => select(index)}><span /></button>)}
      </nav>
    </main>
    {profileMode && <ProfilePanel mode={profileMode} onClose={closeProfile} />}
    {galleryIndex !== null && <CategoryFlow category={works[galleryIndex]} phase={flowPhase} onClose={closeGallery} closeRef={closeRef} />}
    {transitionImage && <div ref={transitionRef} className="flow-transition" style={{ left: transitionImage.rect.left, top: transitionImage.rect.top, width: transitionImage.rect.width, height: transitionImage.rect.height }}><img src={transitionImage.src} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /><img className={`flow-transition-next ${transitionImage.showNext ? 'is-visible' : ''}`} src={transitionImage.nextSrc} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /></div>}
  </>
}

export default App
