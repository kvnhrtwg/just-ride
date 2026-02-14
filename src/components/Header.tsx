import { Bluetooth, User, X } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { ConnectionPanels } from '@/components/ConnectionPanels'
import { type ConnectionState } from '@/hooks/useTrainerBluetooth'
import { authClient } from '@/lib/auth-client'
import './Header.scss'

type HeaderProps = {
  ftp: number
  userEmail: string | null
  isSavingFtp: boolean
  onSaveFtp: (ftp: number) => Promise<void>
  webBluetoothSupported: boolean
  statusMessage: string
  connectionState: ConnectionState
  heartRateConnectionState: ConnectionState
  connectTrainer: () => Promise<void>
  disconnectTrainer: () => void
  connectHeartRateMonitor: () => Promise<void>
  disconnectHeartRateMonitor: () => void
}

export function Header({
  ftp,
  userEmail,
  isSavingFtp,
  onSaveFtp,
  webBluetoothSupported,
  statusMessage,
  connectionState,
  heartRateConnectionState,
  connectTrainer,
  disconnectTrainer,
  connectHeartRateMonitor,
  disconnectHeartRateMonitor,
}: HeaderProps) {
  const userPopoverId = useId()
  const devicesPopoverId = useId()
  const userPopoverRef = useRef<HTMLDivElement | null>(null)
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
      userPopoverRef.current?.hidePopover()
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

      userPopoverRef.current?.hidePopover()
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
      <div className="cp-header-actions">
        <button
          type="button"
          className="cp-settings-trigger"
          popoverTarget={devicesPopoverId}
          popoverTargetAction="toggle"
          aria-label="Open devices"
          aria-haspopup="dialog"
        >
          <Bluetooth size={16} aria-hidden="true" />
          <span>Devices</span>
        </button>
        <button
          type="button"
          className="cp-settings-trigger"
          popoverTarget={userPopoverId}
          popoverTargetAction="toggle"
          aria-label="Open user settings"
          aria-haspopup="dialog"
        >
          <User size={16} aria-hidden="true" />
          <span>User</span>
        </button>
      </div>
      <div
        id={devicesPopoverId}
        popover="auto"
        className="cp-devices-popover"
        role="dialog"
        aria-labelledby={`${devicesPopoverId}-title`}
      >
        <div className="cp-settings-popover-header">
          <h2 id={`${devicesPopoverId}-title`}>Devices</h2>
          <button
            type="button"
            className="cp-settings-close"
            popoverTarget={devicesPopoverId}
            popoverTargetAction="hide"
            aria-label="Close devices"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        {!webBluetoothSupported ? (
          <p className="cp-devices-unsupported">
            Web Bluetooth is not supported in this browser.
          </p>
        ) : null}
        <ConnectionPanels
          webBluetoothSupported={webBluetoothSupported}
          connectionState={connectionState}
          heartRateConnectionState={heartRateConnectionState}
          connectTrainer={connectTrainer}
          disconnectTrainer={disconnectTrainer}
          connectHeartRateMonitor={connectHeartRateMonitor}
          disconnectHeartRateMonitor={disconnectHeartRateMonitor}
        />
        <p className="cp-devices-status">{statusMessage}</p>
      </div>
      <div
        id={userPopoverId}
        ref={userPopoverRef}
        popover="auto"
        className="cp-settings-popover"
        role="dialog"
        aria-labelledby={`${userPopoverId}-title`}
      >
        <div className="cp-settings-popover-header">
          <h2 id={`${userPopoverId}-title`}>User</h2>
          <button
            type="button"
            className="cp-settings-close"
            popoverTarget={userPopoverId}
            popoverTargetAction="hide"
            aria-label="Close user settings"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <form className="cp-settings-form" onSubmit={handleSubmit}>
          <label htmlFor={`${userPopoverId}-ftp`}>FTP</label>
          <input
            id={`${userPopoverId}-ftp`}
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
        <section className="cp-settings-user" aria-labelledby={`${userPopoverId}-user`}>
          <h3 id={`${userPopoverId}-user`}>Account</h3>
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
