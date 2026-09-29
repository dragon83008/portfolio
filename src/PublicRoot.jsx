import React from 'react'
import App from './App.jsx'

export default function PublicRoot() {
  const [works, setWorks] = React.useState(null)
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}portfolio.json`)
      .then((response) => {
        if (!response.ok) throw new Error('作品暂时无法载入')
        return response.json()
      })
      .then(setWorks)
      .catch((cause) => setError(cause.message))
  }, [])
  if (error) return <div className="startup-state">{error}</div>
  if (!works) return <div className="startup-state">正在载入作品</div>
  return <App works={works} />
}
