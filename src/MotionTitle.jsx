import { useEffect, useState } from 'react'

export default function MotionTitle({ title, subtitle }) {
  const [layers, setLayers] = useState({ current: { title, subtitle }, previous: null, revision: 0 })
  useEffect(() => {
    if (layers.current.title === title && layers.current.subtitle === subtitle) return
    const frame = requestAnimationFrame(() => setLayers((old) => ({
      current: { title, subtitle }, previous: old.current, revision: old.revision + 1,
    })))
    return () => cancelAnimationFrame(frame)
  }, [title, subtitle, layers.current])
  return <div className="motion-title focus-sidebar-copy">
    {layers.previous && <div key={`old-${layers.revision}`} className="title-layer title-out" aria-hidden="true"><h2>{layers.previous.title}</h2><p>{layers.previous.subtitle}</p></div>}
    <div key={layers.revision} className={`title-layer ${layers.revision ? 'title-in' : ''}`}><h2>{layers.current.title}</h2><p>{layers.current.subtitle}</p></div>
  </div>
}
