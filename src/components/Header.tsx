import { Settings2, X } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import './Header.scss'

type HeaderProps = {
  ftp: number
  userEmail: string | null
  isSavingFtp: boolean
  onSaveFtp: (ftp: number) => Promise<void>
}

export function Header({ ftp, userEmail, isSavingFtp, onSaveFtp }: HeaderProps) {
  const popoverId = useId()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [ftpInput, setFtpInput] = useState(String(ftp))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [signOutErrorMessage, setSignOutErrorMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    setFtpInput(String(ftp))
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [ftp])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const parsedValue = Number(ftpInput)
    const normalizedValue = Math.round(parsedValue)

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > 2000) {
      setErrorMessage('Enter an FTP between 1 and 2000.')
      return
    }

    try {
      await onSaveFtp(normalizedValue)
      setSuccessMessage('FTP saved.')
      popoverRef.current?.hidePopover()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to save FTP right now.'
      setErrorMessage(message)
    }
  }

  const handleSignOut = async () => {
    if (isSigningOut) return

    setSignOutErrorMessage(null)
    setIsSigningOut(true)

    try {
      const { error } = await authClient.signOut()
      if (error) {
        setSignOutErrorMessage(error.message ?? 'Unable to sign out right now.')
        return
      }

      popoverRef.current?.hidePopover()
      window.location.href = '/login'
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to sign out right now.'
      setSignOutErrorMessage(message)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="cp-header">
      <h1>Just Ride</h1>
      <button
        type="button"
        className="cp-settings-trigger"
        popoverTarget={popoverId}
        popoverTargetAction="toggle"
        aria-label="Open settings"
        aria-haspopup="dialog"
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>Settings</span>
      </button>
      <div
        id={popoverId}
        ref={popoverRef}
        popover="auto"
        className="cp-settings-popover"
        role="dialog"
        aria-labelledby={`${popoverId}-title`}
      >
        <div className="cp-settings-popover-header">
          <h2 id={`${popoverId}-title`}>Settings</h2>
          <button
            type="button"
            className="cp-settings-close"
            popoverTarget={popoverId}
            popoverTargetAction="hide"
            aria-label="Close settings"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <form className="cp-settings-form" onSubmit={handleSubmit}>
          <label htmlFor={`${popoverId}-ftp`}>FTP</label>
          <input
            id={`${popoverId}-ftp`}
            type="number"
            min={1}
            max={2000}
            step={1}
            value={ftpInput}
            onChange={(event) => setFtpInput(event.target.value)}
          />
          {errorMessage ? <p className="cp-settings-error">{errorMessage}</p> : null}
          {successMessage ? <p className="cp-settings-success">{successMessage}</p> : null}
          <div className="cp-settings-actions">
            <button type="submit" className="cp-settings-save" disabled={isSavingFtp}>
              {isSavingFtp ? 'Saving...' : 'Save FTP'}
            </button>
          </div>
        </form>
        <div className="cp-settings-divider" role="presentation" />
        <section className="cp-settings-user" aria-labelledby={`${popoverId}-user`}>
          <h3 id={`${popoverId}-user`}>User</h3>
          <p className="cp-settings-user-email">{userEmail ?? 'Email unavailable'}</p>
          {signOutErrorMessage ? (
            <p className="cp-settings-error">{signOutErrorMessage}</p>
          ) : null}
          <button
            type="button"
            className="cp-settings-signout"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </section>
      </div>
    </header>
  )
}
