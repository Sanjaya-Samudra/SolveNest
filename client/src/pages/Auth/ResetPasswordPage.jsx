import { useState } from 'react'
import { completePasswordReset } from '../../student/authData.js'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const tokens = new URLSearchParams(window.location.hash.slice(1))
  const validLink = tokens.get('type') === 'recovery' && tokens.has('access_token') && tokens.has('refresh_token')

  const submit = async (event) => {
    event.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The passwords do not match.')
    setError('')
    setStatus('saving')
    try {
      await completePasswordReset({ accessToken: tokens.get('access_token'), refreshToken: tokens.get('refresh_token'), password })
      window.history.replaceState({}, '', '/reset-password')
      setStatus('done')
    } catch (requestError) {
      setError(requestError.message || 'Your password could not be updated.')
      setStatus('idle')
    }
  }

  return <section className="sn-auth" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '3rem 1rem' }}><div className="sn-auth-inner" style={{ width: 'min(100%, 440px)' }}>
    <span className="sn-eyebrow">ACCOUNT RECOVERY</span>
    <h1>Choose a new<br /><em>password.</em></h1>
    {!validLink && status !== 'done' && <p className="sn-form-err" role="alert">This reset link is missing or invalid. Request a new link from Sign In.</p>}
    {status === 'done' ? <p role="status">Your password has been updated. <a href="/login">Sign in</a> to continue.</p> : validLink && <form className="sn-form" onSubmit={submit}>
      <label className="sn-field">New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
      <label className="sn-field">Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} /></label>
      {error && <p className="sn-form-err" role="alert">{error}</p>}
      <button className="sn-cta" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Updating…' : 'Update password'}</button>
    </form>}
    {status !== 'done' && <p className="sn-switch"><a href="/login">Back to Sign In</a></p>}
  </div></section>
}
