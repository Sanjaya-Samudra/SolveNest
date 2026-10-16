import { useEffect, useState } from 'react'
import { fetchExpertAccountState, loginExpert } from '../../expert/expertApi.js'
import './expert-dashboard.css'

export function ExpertSignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [mfa, setMfa] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetchExpertAccountState({ signal: controller.signal }).then(() => {
      window.history.replaceState({}, '', '/expert/dashboard')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }).catch(() => {})
    return () => controller.abort()
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await loginExpert({ email: email.trim(), password, otp, factorId: mfa?.factorId })
      window.history.pushState({}, '', '/expert/dashboard')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (requestError) {
      if (requestError.mfa) setMfa(requestError.mfa)
      setError(requestError.serverMessage || requestError.message || 'Expert sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  return <section className="sn-auth" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '3rem 1rem' }}><div className="sn-auth-inner" style={{ width: 'min(100%, 440px)' }}>
    <span className="sn-eyebrow">SOLVENEST EXPERT</span>
    <h1>Welcome back,<br /><em>Expert.</em></h1>
    <p className="sn-lede">Sign in with your approved Expert account to open your assignments.</p>
    <form className="sn-form" onSubmit={submit}>
      <label className="sn-field">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="sn-field">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {mfa && <><div className="sn-form-note"><strong>{mfa.enrolled ? 'Two-step verification' : 'Set up two-step verification'}</strong>{!mfa.enrolled && <><p>Add this account to your authenticator app.</p>{mfa.qrCode && <img src={mfa.qrCode} alt="Authenticator setup QR code" width="180" height="180" />}{mfa.secret && <code>{mfa.secret}</code>}</>}</div><label className="sn-field">Verification code<input type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label></>}
      {error && <p className="sn-form-err" role="alert">{error}</p>}
      <button className="sn-cta" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Open Expert Workspace'}</button>
    </form>
    <p className="sn-switch"><a href="/login">Student sign in</a> · <a href="/connect?intent=general">Need help?</a></p>
  </div></section>
}
