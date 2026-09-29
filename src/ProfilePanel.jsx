import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, Minimize2 } from 'lucide-react'
import { profile } from './profileData.js'

export default function ProfilePanel({ mode, onClose }) {
  const rootRef = useRef(null)
  const closeRef = useRef(null)
  const [copied, setCopied] = useState('')
  const [failedQR, setFailedQR] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const key = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const nodes = [...rootRef.current.querySelectorAll('button, a[href]')].filter((node) => !node.disabled)
      const first = nodes[0], last = nodes.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); requestAnimationFrame(() => previous?.focus({ preventScroll: true })) }
  }, [onClose])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(''), 1800)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); setError('') }
    catch { setError('复制失败，请选择下方文字手动复制。') }
  }
  return <section ref={rootRef} className="profile-dialog" role="dialog" aria-modal="true" aria-label={mode === 'about' ? '关于我' : '联系我'}>
    <aside className="profile-sidebar"><h2>{mode === 'about' ? '段小龙' : '联系我'}</h2><p>{mode === 'about' ? 'Visual Designer / AI Designer' : 'Let’s connect'}</p><button ref={closeRef} className="icon-button" aria-label="返回首页" title="返回首页" onClick={onClose}><Minimize2 size={19} /></button></aside>
    <div className="profile-content">
      {mode === 'about' ? <><section className="intro-section"><h3 className="project-intro-label">关于我</h3><p>{profile.introduction}</p></section>{profile.experiences.map((item) => <section className="intro-section experience-section" key={item.title}><h3>{item.title}</h3><p>{item.text}</p></section>)}</> : <>
        <section className="contact-section"><h3>邮箱</h3><div className="contact-value"><span>{profile.email}</span><button className="icon-button" aria-label="复制邮箱" title="复制邮箱" onClick={() => copy(profile.email)}>{copied === profile.email ? <Check size={18} /> : <Copy size={18} />}</button><a className="icon-button" href={`mailto:${profile.email}`} aria-label="发送邮件" title="发送邮件"><Mail size={18} /></a></div></section>
        {profile.wechat && <section className="contact-section"><h3>微信</h3>{!failedQR && <img className="contact-qr" src={profile.qr} alt="微信联系二维码" onError={() => setFailedQR(true)} />}<div className="contact-value"><span>{profile.wechat}</span><button className="icon-button" aria-label="复制微信号" title="复制微信号" onClick={() => copy(profile.wechat)}>{copied === profile.wechat ? <Check size={18} /> : <Copy size={18} />}</button></div></section>}
        <p className="copy-feedback" role="status">{error || (copied ? '已复制' : '')}</p>
      </>}
    </div>
  </section>
}
