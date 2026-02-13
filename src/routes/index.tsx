import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { Header } from '@/components/Header'
import { MetricCards } from '@/components/MetricCards'
import { useTrainerBluetooth } from '@/hooks/useTrainerBluetooth'
import { ConnectionPanels } from '@/components/ConnectionPanels'
import { ErgControlStrip } from '@/components/ErgControlStrip'
import { StatusBar } from '@/components/StatusBar'

const currentUserQuery = convexQuery(api.auth.getCurrentUser, {})
const userDataQuery = convexQuery(api.userData.getCurrentUserData, {})

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentUserQuery),
      context.queryClient.ensureQueryData(userDataQuery),
    ])
  },
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const setCurrentUserFtp = useConvexMutation(api.userData.setCurrentUserFtp)
  const [isSavingFtp, setIsSavingFtp] = useState(false)
  const { data: userData } = useSuspenseQuery(userDataQuery)
  const model = useTrainerBluetooth({ initialErgTargetWatts: userData.ftp })

  const {
    webBluetoothSupported,
    statusMessage,
    connectionState,
    heartRateConnectionState,
    trainerName,
    heartRateMonitorName,
    livePowerWatts,
    heartRateBpm,
    ergTargetWatts,
    setErgTargetWatts,
    connectTrainer,
    disconnectTrainer,
    connectHeartRateMonitor,
    disconnectHeartRateMonitor,
    setErgTarget,
  } = model

  const handleSaveFtp = async (ftp: number) => {
    setIsSavingFtp(true)
    try {
      await setCurrentUserFtp({ ftp })
      setErgTargetWatts(ftp)
      await queryClient.invalidateQueries({
        queryKey: userDataQuery.queryKey,
      })
    } finally {
      setIsSavingFtp(false)
    }
  }

  return (
    <main className="cp-page">
      <div className="cp-shell">
        <Header ftp={userData.ftp} onSaveFtp={handleSaveFtp} isSavingFtp={isSavingFtp} />

        <MetricCards
          livePowerWatts={livePowerWatts}
          trainerName={trainerName}
          connectionState={connectionState}
          heartRateBpm={heartRateBpm}
          heartRateMonitorName={heartRateMonitorName}
          heartRateConnectionState={heartRateConnectionState}
        />

        <ConnectionPanels
          webBluetoothSupported={webBluetoothSupported}
          connectionState={connectionState}
          heartRateConnectionState={heartRateConnectionState}
          connectTrainer={connectTrainer}
          disconnectTrainer={disconnectTrainer}
          connectHeartRateMonitor={connectHeartRateMonitor}
          disconnectHeartRateMonitor={disconnectHeartRateMonitor}
        />

        <ErgControlStrip
          ergTargetWatts={ergTargetWatts}
          setErgTargetWatts={setErgTargetWatts}
          setErgTarget={setErgTarget}
          connectionState={connectionState}
        />

        <StatusBar
          connectionState={connectionState}
          statusMessage={statusMessage}
        />
      </div>
    </main>
  )
}
