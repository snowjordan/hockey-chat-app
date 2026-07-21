import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login({ accessDenied = false }) {
  const [email, setEmail] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [sendingLink, setSendingLink] = useState(false)

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      console.error('Google sign-in error:', error.message)
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault()

    const trimmedEmail = email.trim()

    setEmailMessage('')
    setEmailError('')

    if (!trimmedEmail) {
      setEmailError('Enter your email address.')
      return
    }

    setSendingLink(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    })

    if (error) {
      console.error('Magic-link sign-in error:', error)

      if (
        error.message?.toLowerCase().includes('rate limit')
      ) {
        setEmailError(
        'Too many sign-in links have been requested. Please wait and try again later.'
      )
      } else {
        setEmailError(
            'We could not send a sign-in link. Make sure this email has been connected to a league account.'
        )
      }

      setSendingLink(false)
      return
    }

    setEmailMessage(
      'Check your email for a sign-in link. The link can only be used once.'
    )

    setSendingLink(false)
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
              Sign in with Google or request a one-time sign-in link
              using the email connected to your league profile.
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
              onSubmit={sendMagicLink}
            >
              <label htmlFor="login-email">
                Email address
              </label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={sendingLink}
                required
              />

              <button
                className="email-sign-in-button"
                type="submit"
                disabled={sendingLink}
              >
                {sendingLink
                  ? 'Sending link...'
                  : 'Email me a sign-in link'}
              </button>

              {emailMessage && (
                <p
                  className="login-message login-message-success"
                  role="status"
                >
                  {emailMessage}
                </p>
              )}

              {emailError && (
                <p
                  className="login-message login-message-error"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </form>
          </>
        )}
      </section>
    </main>
  )
}