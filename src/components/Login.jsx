import { supabase } from '../lib/supabaseClient'

export default function Login() {
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

    return (
        <main className="login-page">
            <section className="login-panel">
                <div className="login-logo">CEO League</div>

                <h1>Sign in</h1>

                <p className="login-help">
                    Use your Google account to access your teams, schedule, directory, and league updates.
                </p>

                <button className="google-sign-in-button" onClick={signInWithGoogle}>
                    Continue with Google
                </button>
            </section>
        </main>
    )

}