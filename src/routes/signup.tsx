import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message ?? 'Unable to create account.')
      setIsSubmitting(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <main className="cp-page cp-page--auth">
      <div className="cp-auth-shell">
        <h1 className="cp-auth-brand">Just Ride</h1>
        <section className="cp-auth-card" aria-labelledby="signup-title">
          <h2 id="signup-title" className="cp-auth-heading">
            Create account
          </h2>
          <p className="cp-auth-subtitle">
            Create your account to start your next ride.
          </p>

          <form className="cp-auth-form" onSubmit={handleSubmit}>
            <div className="cp-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="cp-auth-error">{error}</p> : null}

            <button
              className="cp-auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <footer className="cp-auth-footer">
            <Link className="cp-auth-link" to="/">
              Back to home
            </Link>
            <Link className="cp-auth-link" to="/login">
              Already have an account?
            </Link>
          </footer>
        </section>
      </div>
    </main>
  )
}
