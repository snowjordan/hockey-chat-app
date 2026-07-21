import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login({ accessDenied = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  async function signInWithGoogle() {
    setLoginError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      console.error('Google sign-in error:', error.message)
      setLoginError('Google sign-in could not be started.')
    }
  }

  async function signInWithEmail(event) {
    event.preventDefault()

    const trimmedEmail = email.trim()

    setLoginError('')

    if (!trimmedEmail || !password) {
      setLoginError('Enter your email address and password.')
      return
    }

    setSigningIn(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      console.error('Email sign-in error:', error)

      setLoginError(
        'The email address or password is incorrect.'
      )

      setSigningIn(false)
      return
    }

    setSigningIn(false)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign-out error:', error.message)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-logo">CEO League</div>

        {accessDenied ? (
          <>
            <h1>Account not connected</h1>

            <p className="login-help">
              This account is not connected to a CEO League player
              profile. Contact the league administrator to have your
              account connected.
            </p>

            <button
              className="google-sign-in-button"
              type="button"
              onClick={signOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <h1>Sign in</h1>

            <p className="login-help">
              Sign in with Google or use the email address and password
              connected to your league account.
            </p>

            <button
              className="google-sign-in-button"
              type="button"
              onClick={signInWithGoogle}
            >
              Continue with Google
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <form
              className="email-login-form"
              onSubmit={signInWithEmail}
            >
              <label htmlFor="login-email">
                Email address
              </label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={signingIn}
                required
              />

              <label htmlFor="login-password">
                Password
              </label>

              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={signingIn}
                required
              />

              <button
                className="email-sign-in-button"
                type="submit"
                disabled={signingIn}
              >
                {signingIn ? 'Signing in...' : 'Sign in'}
              </button>

              {loginError && (
                <p
                  className="login-message login-message-error"
                  role="alert"
                >
                  {loginError}
                </p>
              )}
            </form>
          </>
        )}
      </section>
    </main>
  )
}