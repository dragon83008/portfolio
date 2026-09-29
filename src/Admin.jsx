import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ExternalLink, Globe2, ImagePlus, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react'
import './Admin.css'
import { introSections } from './projectContent.js'

const makeId = () => crypto.randomUUID()

async function api(path, options) {
  const response = await fetch(path, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data
}

function notifyPortfolio() {
  try { window.localStorage.setItem('portfolio-updated', crypto.randomUUID()) } catch { /* Focus refresh remains available. */ }
}

function MediaPreview({ asset, label }) {
  if (!asset) return <div className="admin-media-empty">暂无{label}</div>
  return asset.type === 'video' ? <video src={asset.src} poster={asset.poster} controls preload="metadata" /> : <img src={asset.src || asset} alt={label} />
}

function Admin() {
  const [categories, setCategories] = useState(null)
  const [activeCategory, setActiveCategory] = useState('commercial')
  const [activeProject, setActiveProject] = useState(null)
  const [showTrash, setShowTrash] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dragged, setDragged] = useState(null)
  const [previewAsset, setPreviewAsset] = useState(null)
  const nameInputRef = useRef(null)
  const focusNewProject = useRef(false)
  const unsavedProjects = useRef(new Set())

  useEffect(() => {
    api('/api/admin/state').then((state) => {
      setCategories(state.draft)
      setActiveProject(state.draft[0]?.projects[0]?.id || null)
    }).catch((cause) => setError(cause.message))
  }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!previewAsset) return
    const onKey = (event) => { if (event.key === 'Escape') setPreviewAsset(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewAsset])
  useEffect(() => {
    if (!focusNewProject.current) return
    focusNewProject.current = false
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [activeProject])

  const category = categories?.find((item) => item.id === activeCategory)
  const project = category?.projects.find((item) => item.id === activeProject)
  const visibleProjects = category?.projects.filter((item) => item.trashed === showTrash) || []
  const totalDrafts = categories?.flatMap((item) => item.projects).filter((item) => item.status === 'draft' && !item.trashed).length || 0
  const totalReview = categories?.flatMap((item) => item.projects).filter((item) => item.visibility === 'review' && !item.trashed).length || 0

  function changeCategories(update) {
    setCategories((current) => update(current))
    setDirty(true); setNotice(''); setError('')
  }
  function changeCategory(update) {
    changeCategories((current) => current.map((item) => item.id === activeCategory ? update(item) : item))
  }
  function changeProject(update) {
    changeCategory((current) => ({ ...current, projects: current.projects.map((item) => item.id === activeProject ? { ...update(item), status: 'draft' } : item) }))
  }
  function moveProject(id, direction) {
    changeCategory((current) => {
      const projects = [...current.projects]
      const from = projects.findIndex((item) => item.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= projects.length || projects[from].trashed !== projects[to].trashed) return current
      projects.splice(to, 0, ...projects.splice(from, 1))
      return { ...current, projects }
    })
  }
  function moveAsset(index, direction) {
    changeProject((current) => {
      const assets = [...current.assets]
      const to = index + direction
      if (to < 0 || to >= assets.length) return current
      ;[assets[index], assets[to]] = [assets[to], assets[index]]
      return { ...current, assets }
    })
  }
  function addProject() {
    const id = makeId()
    unsavedProjects.current.add(id)
    focusNewProject.current = true
    changeCategory((current) => ({ ...current, projects: [...current.projects, { id, title: '未命名作品', role: 'Independent Project', description: '', introSections: [], visibility: 'review', status: 'draft', trashed: false, cover: '', assets: [] }] }))
    setShowTrash(false); setActiveProject(id)
  }
  async function setProjectTrash(trashed) {
    if (!project || busy) return
    if (trashed && !window.confirm(`删除「${project.title}」？作品将立即从本地作品集消失，并进入回收站。`)) return
    const id = project.id
    if (unsavedProjects.current.has(id)) {
      if (trashed) {
        changeCategory((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== id) }))
        unsavedProjects.current.delete(id)
        setActiveProject(null)
      }
      return
    }
    setBusy(trashed ? '正在删除作品' : '正在恢复作品'); setError(''); setNotice('')
    try {
      const result = await api(`/api/admin/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: trashed ? 'trash' : 'restore' }) })
      setCategories((current) => current.map((category) => ({ ...category, projects: category.projects.map((item) => item.id === id ? { ...item, trashed } : item) })))
      setShowTrash(trashed)
      setNotice(trashed ? '作品已移入回收站，并从本地作品集移除' : result.published ? '作品已恢复到本地作品集' : '作品已恢复为草稿，发布后会出现在作品集')
      notifyPortfolio()
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function permanentlyRemoveProject() {
    if (!project || busy || !window.confirm(`永久移除「${project.title}」的项目记录？此操作立即生效且无法在回收站恢复；上传原件仍会保留。`)) return
    const id = project.id
    setBusy('正在永久移除作品'); setError(''); setNotice('')
    try {
      await api(`/api/admin/projects/${id}`, { method: 'DELETE' })
      setCategories((current) => current.map((category) => ({ ...category, projects: category.projects.filter((item) => item.id !== id) })))
      setActiveProject(null)
      setNotice('项目记录已永久移除，上传原件仍保留')
      notifyPortfolio()
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function uploadFile(file, onComplete) {
    if (!file) return
    setBusy('正在处理素材，视频可能需要几分钟'); setError(''); setNotice('')
    try {
      const form = new FormData()
      form.append('file', file)
      const asset = await api('/api/admin/upload', { method: 'POST', body: form })
      onComplete(asset)
      setNotice('素材已处理，请保存草稿')
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function saveDraft(source = categories) {
    setBusy('正在保存草稿'); setError('')
    try {
      await api('/api/admin/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: source }) })
      unsavedProjects.current.clear()
      notifyPortfolio()
      setDirty(false); setNotice('草稿已保存')
      return true
    } catch (cause) { setError(cause.message); return false }
    finally { setBusy('') }
  }
  async function publish() {
    const saved = await saveDraft()
    if (!saved) return
    setBusy('正在发布'); setError('')
    try {
      const result = await api('/api/admin/publish', { method: 'POST' })
      const state = await api('/api/admin/state')
      setCategories(state.draft); setNotice(result.unfinished ? `已发布，${result.unfinished} 个未完成项目仍保留草稿` : '已发布到本地作品集')
      notifyPortfolio()
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function preview() {
    const saved = dirty ? await saveDraft() : true
    if (saved) window.open('/?preview=1', '_blank', 'noopener')
  }
  async function previewCovers() {
    if (busy) return
    setBusy('正在保存首页封面'); setError('')
    try {
      await api('/api/admin/category-covers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covers: Object.fromEntries(categories.map((item) => [item.id, item.cover])) }) })
      setNotice('首页封面已保存为候选，正式首页未改变')
      window.open('/?coverPreview=1', '_blank', 'noopener')
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function publishCovers() {
    if (busy) return
    setBusy('正在发布首页封面'); setError('')
    try {
      await api('/api/admin/category-covers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covers: Object.fromEntries(categories.map((item) => [item.id, item.cover])) }) })
      await api('/api/admin/category-covers/publish', { method: 'POST' })
      setNotice('仅首页五张分类封面已发布，其他项目草稿未发布')
      notifyPortfolio()
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  async function previewPublic() {
    if (busy) return
    setBusy('正在生成公开预览'); setError(''); setNotice('')
    try {
      const result = await api('/api/admin/publication/preview', { method: 'POST' })
      setNotice(`公开预览已生成：${result.categories} 个分类、${result.projects} 个项目。未发布草稿和待确认作品未包含。`)
      window.open(result.url, '_blank', 'noopener')
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }

  if (!categories) return <div className="admin-loading">{error || '正在打开作品管理'}</div>
  return <div className="admin-shell">
    <header className="admin-topbar">
      <div className="admin-brand"><span className="admin-brand-mark">DXL</span><span>作品管理</span></div>
      <div className="admin-top-actions">
        <a href="/" target="_blank" rel="noreferrer" className="admin-link"><ExternalLink size={16} /> 作品集</a>
        <button type="button" className="admin-button" onClick={preview} disabled={Boolean(busy)}>预览草稿</button>
        <button type="button" className="admin-button" onClick={previewPublic} disabled={Boolean(busy)}><Globe2 size={16} /> 预览公开版</button>
        <button type="button" className="admin-button" onClick={previewCovers} disabled={Boolean(busy)}>预览首页封面</button>
        <button type="button" className="admin-button" onClick={publishCovers} disabled={Boolean(busy)}><Check size={16} /> 仅发布首页封面</button>
        <button type="button" className="admin-button" onClick={() => saveDraft()} disabled={Boolean(busy) || !dirty}><Save size={16} /> 保存草稿</button>
        <button type="button" className="admin-button admin-button-dark" onClick={publish} disabled={Boolean(busy)}><Check size={16} /> 发布全部更改</button>
      </div>
    </header>
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head"><span>分类</span><small>05</small></div>
        <nav aria-label="作品分类" className="admin-categories">
          {categories.map((item) => <button type="button" key={item.id} className={item.id === activeCategory ? 'selected' : ''} onClick={() => { setActiveCategory(item.id); setActiveProject(item.projects.find((entry) => !entry.trashed)?.id || null); setShowTrash(false) }}><span>{item.title}</span><small>{item.projects.filter((entry) => !entry.trashed).length}</small></button>)}
        </nav>
        <div className="admin-sidebar-footer"><span>{totalDrafts} 个待发布项目</span><span>{totalReview} 个待确认授权</span><a href="/api/admin/backup" download>下载数据备份</a></div>
      </aside>
      <main className="admin-main">
        <div className="admin-heading"><div><small>PORTFOLIO / {category.id.toUpperCase()}</small><h1>{category.title}</h1></div><div className="admin-heading-actions"><button type="button" className="admin-button" onClick={() => { setShowTrash(!showTrash); setActiveProject(null) }}><Trash2 size={16} /> {showTrash ? '返回作品' : '回收站'}</button>{!showTrash && <button type="button" className="admin-button admin-button-dark" onClick={addProject}><Plus size={17} /> 添加作品</button>}</div></div>
        <div className="admin-content-grid">
          <section className="admin-list-panel">
            {!showTrash && <div className="admin-cover-row"><div className="admin-cover-thumb"><MediaPreview asset={category.cover} label={`${category.title}封面`} /></div><div><strong>分类封面</strong><small>首页卡片使用</small></div><label className="admin-icon-control" title="更换分类封面"><ImagePlus size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { uploadFile(event.target.files[0], (asset) => { if (asset.type !== 'image') return setError('分类封面只能使用图片'); changeCategory((current) => ({ ...current, cover: asset.src })) }); event.target.value = '' }} /></label></div>}
            <div className="admin-list-title"><span>{showTrash ? '已移入回收站' : '作品列表'}</span><small>{visibleProjects.length}</small></div>
            <div className="admin-project-list">
              {visibleProjects.length === 0 && <p className="admin-empty">{showTrash ? '回收站为空' : '这里还没有作品，点击上方「添加作品」开始。'}</p>}
              {visibleProjects.map((item) => <div key={item.id} className={`admin-project-row ${activeProject === item.id ? 'selected' : ''}`} draggable={!showTrash} onDragStart={() => setDragged(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged && dragged !== item.id) { const from = category.projects.findIndex((entry) => entry.id === dragged); const to = category.projects.findIndex((entry) => entry.id === item.id); moveProject(dragged, to - from) } setDragged(null) }}>
                <button type="button" className="admin-project-select" onClick={() => setActiveProject(item.id)}><span className="admin-project-thumb">{item.cover || item.assets[0] ? <MediaPreview asset={item.cover || (item.assets[0].type === 'video' ? item.assets[0].poster : item.assets[0].src)} label={item.title} /> : <span>+</span>}</span><span className="admin-project-name"><strong>{item.title}</strong><small>{item.trashed ? '已回收' : item.status === 'draft' ? '草稿' : '已发布'} · {item.assets.length} 项素材</small></span></button>
                {!showTrash && <div className="admin-reorder"><button type="button" title="上移" aria-label={`上移${item.title}`} onClick={() => moveProject(item.id, -1)}><ArrowUp size={14} /></button><button type="button" title="下移" aria-label={`下移${item.title}`} onClick={() => moveProject(item.id, 1)}><ArrowDown size={14} /></button></div>}
              </div>)}
            </div>
          </section>
          <section className="admin-editor">
            {!project ? <div className="admin-editor-empty">{showTrash ? '从左侧选择要恢复或永久移除的作品。' : '从左侧选择一个作品，或点击「添加作品」。'}</div> : <>
              <div className="admin-editor-head"><div><small>PROJECT EDITOR</small><h2>{project.title}</h2></div><span className={`admin-status ${project.trashed ? 'trash' : project.status}`}>{project.trashed ? '回收站' : project.status === 'draft' ? '草稿' : '已发布'}</span></div>
              <div className="admin-project-cover"><button type="button" className="admin-project-cover-image" aria-label="预览项目封面" onClick={() => setPreviewAsset({ type: 'image', src: project.cover || project.assets[0]?.poster || project.assets[0]?.src || category.cover })}><MediaPreview asset={project.cover || project.assets[0]?.poster || project.assets[0]?.src || category.cover} label="项目封面" /></button><div><strong>项目封面</strong><small>用于作品预演与管理列表</small></div><label className="admin-button"><ImagePlus size={16} /> 更换封面<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const id = project.id; uploadFile(event.target.files[0], (asset) => { if (asset.type !== 'image') return setError('项目封面只能使用图片'); changeCategory((current) => ({ ...current, projects: current.projects.map((entry) => entry.id === id ? { ...entry, cover: asset.src, coverWidth: asset.width, coverHeight: asset.height, status: 'draft' } : entry) })) }); event.target.value = '' }} /></label></div>
              <div className="admin-fields"><label>作品名称<input ref={nameInputRef} value={project.title} maxLength={120} onChange={(event) => changeProject((current) => ({ ...current, title: event.target.value }))} /></label><label>展示署名<input value={project.role || ''} maxLength={120} onChange={(event) => changeProject((current) => ({ ...current, role: event.target.value }))} /></label><label>公开权限<select value={project.visibility} onChange={(event) => changeProject((current) => ({ ...current, visibility: event.target.value }))}><option value="review">待确认 · 仅本地预览</option><option value="public">已确认可公开</option></select></label></div>
              <section className="admin-intro-editor" aria-label="项目介绍">
                <header><h3>项目介绍</h3><button type="button" disabled={introSections(project).length >= 12 || Boolean(busy)} onClick={() => changeProject((current) => ({ ...current, introSections: [...introSections(current), { id: makeId(), title: '', body: '' }] }))}><Plus size={16} />添加分块</button></header>
                <datalist id="intro-title-options"><option value="项目背景" /><option value="创作思路" /><option value="个人职责" /></datalist>
                {introSections(project).map((section, index, all) => <fieldset className="admin-intro-block" key={section.id}>
                  <legend>介绍 {index + 1}</legend>
                  <label>分块标题<input list="intro-title-options" maxLength={80} value={section.title} onChange={(event) => changeProject((current) => ({ ...current, introSections: introSections(current).map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) }))} /></label>
                  <label>分块正文<textarea rows={5} maxLength={3000} value={section.body} onChange={(event) => changeProject((current) => ({ ...current, introSections: introSections(current).map((item) => item.id === section.id ? { ...item, body: event.target.value } : item) }))} /></label>
                  <div className="admin-intro-actions">{[-1, 1].map((direction) => <button type="button" key={direction} aria-label={`${direction === -1 ? '上移' : '下移'}介绍${index + 1}`} title={direction === -1 ? '上移' : '下移'} disabled={Boolean(busy) || index + direction < 0 || index + direction >= all.length} onClick={() => changeProject((current) => { const items = [...introSections(current)]; [items[index], items[index + direction]] = [items[index + direction], items[index]]; return { ...current, introSections: items } })}>{direction === -1 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</button>)}<button type="button" aria-label={`删除介绍${index + 1}`} title="删除分块" disabled={Boolean(busy)} onClick={() => { if ((section.body || section.title) && !window.confirm('删除这一介绍分块？保存草稿后生效。')) return; changeProject((current) => ({ ...current, introSections: introSections(current).filter((item) => item.id !== section.id) })) }}><Trash2 size={16} /></button></div>
                </fieldset>)}
                <small>空正文不展示。保存草稿后预览，确认后发布；仅发布首页封面不会发布介绍。</small>
              </section>
              <div className="admin-assets-head"><div><h3>作品素材</h3><small>图片保持原始比例；视频自动生成网页预览和封面</small></div>{!project.trashed && <label className="admin-button"><Upload size={16} /> 上传图片 / 视频<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-m4v,.mov,.m4v" onChange={(event) => { const id = project.id; uploadFile(event.target.files[0], (asset) => changeCategory((current) => ({ ...current, projects: current.projects.map((entry) => entry.id === id ? { ...entry, assets: [...entry.assets, asset], status: 'draft' } : entry) }))); event.target.value = '' }} /></label>}</div>
              <div className="admin-assets">{project.assets.length === 0 && <div className="admin-assets-empty">还没有素材。上传图片或视频后，可以预览并发布。</div>}{project.assets.map((asset, index) => <div className="admin-asset" key={asset.id}><button type="button" className="admin-asset-preview" title="预览素材" aria-label={`预览${project.title}素材${index + 1}`} onClick={() => setPreviewAsset(asset)}><MediaPreview asset={asset.type === 'video' ? asset.poster : asset.src} label={`${project.title}素材`} /></button><div className="admin-asset-info"><strong>{asset.type === 'video' ? '视频' : '图片'} {String(index + 1).padStart(2, '0')}</strong><small>{asset.width} × {asset.height} · {asset.orientation === 'portrait' ? '竖版' : asset.orientation === 'landscape' ? '横版' : '方形'}</small></div><div className="admin-asset-actions"><button type="button" title="上移" aria-label="上移素材" onClick={() => moveAsset(index, -1)}><ArrowUp size={16} /></button><button type="button" title="下移" aria-label="下移素材" onClick={() => moveAsset(index, 1)}><ArrowDown size={16} /></button><button type="button" title="移除素材" aria-label="移除素材" onClick={() => changeProject((current) => ({ ...current, assets: current.assets.filter((entry) => entry.id !== asset.id) }))}><X size={16} /></button></div></div>)}</div>
              <div className="admin-editor-bottom">{project.trashed ? <><button type="button" className="admin-button" disabled={Boolean(busy)} onClick={() => setProjectTrash(false)}><RotateCcw size={16} /> 恢复作品</button><button type="button" className="admin-button admin-danger" disabled={Boolean(busy)} onClick={permanentlyRemoveProject}><Trash2 size={16} /> 永久删除作品</button></> : <button type="button" className="admin-button admin-danger" disabled={Boolean(busy)} onClick={() => setProjectTrash(true)}><Trash2 size={16} /> 删除作品</button>}</div>
            </>}
          </section>
        </div>
      </main>
    </div>
    {previewAsset && <div className="admin-preview" role="dialog" aria-modal="true" aria-label="素材预览" onClick={() => setPreviewAsset(null)}><button type="button" className="admin-preview-close" aria-label="关闭预览" onClick={() => setPreviewAsset(null)}><X size={22} /></button><div onClick={(event) => event.stopPropagation()}>{previewAsset.type === 'video' ? <video src={previewAsset.src} poster={previewAsset.poster} controls autoPlay /> : <img src={previewAsset.src} alt="作品素材预览" />}</div></div>}
    {(notice || error || busy) && <div role="status" className={`admin-toast ${error ? 'error' : ''}`}>{error || busy || notice}<button type="button" aria-label="关闭提示" onClick={() => { setNotice(''); setError('') }}><X size={14} /></button></div>}
  </div>
}

export default Admin
