import { useEffect, useState } from 'react'
import App from './App.jsx'
import Admin from './Admin.jsx'

function Root() {
  const admin = window.location.pathname.startsWith('/admin')
  const preview = new URLSearchParams(window.location.search).get('preview') === '1'
  const coverPreview = new URLSearchParams(window.location.search).get('coverPreview') === '1'
  const [works, setWorks] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (admin) return
    let requestId = 0
    const refresh = () => {
      const current = ++requestId
      fetch(`/api/portfolio${coverPreview ? '?coverPreview=1' : preview ? '?preview=1' : ''}`, { cache: 'no-store' })
        .then(async (response) => { if (!response.ok) throw new Error('本地服务未启动'); return response.json() })
        .then((data) => { if (current === requestId) { setWorks(data); setError('') } })
        .catch((cause) => { if (current === requestId) setError(cause.message) })
    }
    const onStorage = (event) => { if (event.key === 'portfolio-updated') refresh() }
    const onVisibility = () => { if (!document.hidden) refresh() }
    refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      requestId += 1
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [admin, preview, coverPreview])
  if (admin) return <Admin />
  if (error) return <div className="startup-state"><p>{error}</p><small>请使用「启动作品集.cmd」打开网站。</small></div>
  if (!works) return <div className="startup-state">正在载入作品</div>
  return <App works={works} preview={preview ? 'draft' : coverPreview ? 'cover' : false} />
}

export default Root
