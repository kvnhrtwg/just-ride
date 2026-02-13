import { type ConnectionState } from '@/hooks/useTrainerBluetooth'
import './ConnectionPanels.css'

type ConnectionPanelsProps = {
  webBluetoothSupported: boolean
  connectionState: ConnectionState
  heartRateConnectionState: ConnectionState
  connectTrainer: () => Promise<void>
  disconnectTrainer: () => void
  connectHeartRateMonitor: () => Promise<void>
  disconnectHeartRateMonitor: () => void
}

export function ConnectionPanels({
  webBluetoothSupported,
  connectionState,
  heartRateConnectionState,
  connectTrainer,
  disconnectTrainer,
  connectHeartRateMonitor,
  disconnectHeartRateMonitor,
}: ConnectionPanelsProps) {
  return (
    <section className="cp-connections">
      <div className="cp-panel">
        <span className="cp-panel-label">Trainer Control</span>
        {connectionState === 'connected' ? (
          <button
            className="cp-switch cp-switch--off"
            onClick={disconnectTrainer}
          >
            Disconnect Trainer
          </button>
        ) : (
          <button
            className="cp-switch cp-switch--on"
            onClick={connectTrainer}
            disabled={
              !webBluetoothSupported || connectionState === 'connecting'
            }
          >
            {connectionState === 'connecting'
              ? 'Connecting...'
              : 'Connect Trainer'}
          </button>
        )}
      </div>

      <div className="cp-panel">
        <span className="cp-panel-label">Heart Rate Monitor</span>
        {heartRateConnectionState === 'connected' ? (
          <button
            className="cp-switch cp-switch--off"
            onClick={disconnectHeartRateMonitor}
          >
            Disconnect HR Monitor
          </button>
        ) : (
          <button
            className="cp-switch cp-switch--on"
            onClick={connectHeartRateMonitor}
            disabled={
              !webBluetoothSupported ||
              heartRateConnectionState === 'connecting'
            }
          >
            {heartRateConnectionState === 'connecting'
              ? 'Connecting HR...'
              : 'Connect HR Monitor'}
          </button>
        )}
      </div>
    </section>
  )
}
