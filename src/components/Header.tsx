import { Bluetooth, User } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { ConnectionPanels } from '@/components/ConnectionPanels'
import { Popover } from '@/components/Popover'
import { type ConnectionState } from '@/hooks/useTrainerBluetooth'
import { authClient } from '@/lib/auth-client'
import './Header.scss'

type HeaderProps = {
  ftp: number
  weightKg: number
  userEmail: string | null
  isSavingUserData: boolean
  onSaveUserData: (userData: { ftp: number; weightKg: number }) => Promise<void>
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
  weightKg,
  userEmail,
  isSavingUserData,
  onSaveUserData,
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
  const [weightInput, setWeightInput] = useState(String(weightKg))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [signOutErrorMessage, setSignOutErrorMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    setFtpInput(String(ftp))
    setWeightInput(String(weightKg))
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [ftp, weightKg])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const parsedFtp = Number(ftpInput)
    const normalizedFtp = Math.round(parsedFtp)

    if (!Number.isFinite(normalizedFtp) || normalizedFtp < 1 || normalizedFtp > 2000) {
      setErrorMessage('Enter an FTP between 1 and 2000.')
      return
    }

    const parsedWeightKg = Number(weightInput)
    const normalizedWeightKg = Math.round(parsedWeightKg * 10) / 10

    if (
      !Number.isFinite(normalizedWeightKg) ||
      normalizedWeightKg < 20 ||
      normalizedWeightKg > 300
    ) {
      setErrorMessage('Enter a weight between 20 and 300 kg.')
      return
    }

    try {
      await onSaveUserData({
        ftp: normalizedFtp,
        weightKg: normalizedWeightKg,
      })
      setSuccessMessage('Settings saved.')
      userPopoverRef.current?.hidePopover()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to save settings right now.'
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
      <h1>NEOON</h1>
      <div className="cp-header-actions">
        <button
          type="button"
          className="cp-btn cp-settings-trigger"
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
          className="cp-btn cp-settings-trigger"
          popoverTarget={userPopoverId}
          popoverTargetAction="toggle"
          aria-label="Open user settings"
          aria-haspopup="dialog"
        >
          <User size={16} aria-hidden="true" />
          <span>User</span>
        </button>
      </div>
      <Popover
        id={devicesPopoverId}
        title="Devices"
        closeLabel="Close devices"
        className="cp-devices-popover"
        size="wide"
      >
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
      </Popover>
      <Popover
        id={userPopoverId}
        ref={userPopoverRef}
        title="User"
        closeLabel="Close user settings"
        className="cp-settings-popover"
      >
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
          <label htmlFor={`${userPopoverId}-weight`}>Weight (kg)</label>
          <input
            id={`${userPopoverId}-weight`}
            type="number"
            min={20}
            max={300}
            step={0.1}
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
          />
          {errorMessage ? <p className="cp-settings-error">{errorMessage}</p> : null}
          {successMessage ? <p className="cp-settings-success">{successMessage}</p> : null}
          <div className="cp-settings-actions">
            <button
              type="submit"
              className="cp-btn cp-settings-save"
              disabled={isSavingUserData}
            >
              {isSavingUserData ? 'Saving...' : 'Save settings'}
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
            className="cp-btn cp-btn-danger cp-settings-signout"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </section>
      </Popover>
    </header>
  )
}
