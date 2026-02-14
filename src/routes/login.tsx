import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message ?? 'Unable to sign in.')
      setIsSubmitting(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <main className="cp-page cp-page--auth">
      <div className="cp-auth-shell">
        <h1 className="cp-auth-brand">Just Ride</h1>
        <section className="cp-auth-card" aria-labelledby="login-title">
          <h2 id="login-title" className="cp-auth-heading">
            Log in
          </h2>
          <p className="cp-auth-subtitle">
            Welcome back. Enter your email and password.
          </p>

          <form className="cp-auth-form" onSubmit={handleSubmit}>
            <div className="cp-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="cp-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="cp-auth-error">{error}</p> : null}

            <button
              className="cp-btn cp-auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <footer className="cp-auth-footer">
            <Link className="cp-auth-link" to="/signup">
              Create account
            </Link>
            <Link className="cp-auth-link" to="/">
              Back to home
            </Link>
          </footer>
        </section>
      </div>
    </main>
  )
}
