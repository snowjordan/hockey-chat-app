import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SetPassword({ onComplete }) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        setErrorMessage('')

        if (password.length < 8) {
            setErrorMessage(
                'Password must be at least 8 characters.'
            )
            return
        }

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.')
            return
        }

        setIsSubmitting(true)

        const {
            data: sessionData,
            error: sessionError,
        } = await supabase.auth.getSession()

        if (
            sessionError ||
            !sessionData.session?.user
        ) {
            console.error(
                'No valid session is available for setting a password',
                sessionError
            )

            setErrorMessage(
                'This invitation link is invalid or has expired. Request a new email and try again.'
            )
            setIsSubmitting(false)
            return
        }

        const { error: passwordError } =
            await supabase.auth.updateUser({
                password,
            })

        if (passwordError) {
            console.error(
                'Unable to set password',
                passwordError
            )

            setErrorMessage(
                passwordError.message ||
                    'Unable to set your password. Please try again.'
            )
            setIsSubmitting(false)
            return
        }

        const {
            data: linkResult,
            error: linkError,
        } = await supabase.rpc(
            'link_authenticated_profile'
        )

        if (linkError) {
            console.error(
                'Password was set, but the profile could not be connected',
                linkError
            )

            setErrorMessage(
                'Your password was saved, but your player profile could not be connected. Contact the league administrator.'
            )
            setIsSubmitting(false)
            return
        }

        const linkSucceeded =
            linkResult?.status === 'linked' ||
            linkResult?.status === 'already_linked'

        if (!linkSucceeded) {
            console.warn(
                'Profile connection failed after setting password',
                linkResult
            )

            setErrorMessage(
                'Your password was saved, but no matching player profile could be found. Contact the league administrator.'
            )
            setIsSubmitting(false)
            return
        }

        if (onComplete) {
            await onComplete()
            return
        }

        window.history.replaceState(
            {},
            '',
            '/'
        )
        window.location.reload()
    }

    return (
        <main className="login-page">
            <section className="login-panel">
                <div className="login-logo">
                    CEO LEAGUE
                </div>

                <h1>Create your password</h1>

                <p className="login-help">
                    Create a password to use when
                    signing in to your league account.
                </p>

                <form
                    className="email-login-form"
                    onSubmit={handleSubmit}
                >
                    <label htmlFor="new-password">
                        New password
                    </label>

                    <input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) =>
                            setPassword(
                                event.target.value
                            )
                        }
                        required
                    />

                    <label htmlFor="confirm-password">
                        Confirm password
                    </label>

                    <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) =>
                            setConfirmPassword(
                                event.target.value
                            )
                        }
                        required
                    />

                    {errorMessage && (
                        <p
                            className="form-error"
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="email-sign-in-button"
                        className='primary-button'
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? 'Saving password...'
                            : 'Create password'}
                    </button>
                </form>
            </section>
        </main>
    )
}