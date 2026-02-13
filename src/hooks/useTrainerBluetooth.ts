import { useCallback, useEffect, useRef, useState } from 'react'

const CYCLING_POWER_SERVICE_UUID = 0x1818
const CYCLING_POWER_MEASUREMENT_UUID = 0x2a63
const FITNESS_MACHINE_SERVICE_UUID = 0x1826
const INDOOR_BIKE_DATA_UUID = 0x2ad2
const FITNESS_MACHINE_CONTROL_POINT_UUID = 0x2ad9
const HEART_RATE_SERVICE_UUID = 0x180d
const HEART_RATE_MEASUREMENT_UUID = 0x2a37
const REQUEST_CONTROL_OPCODE = 0x00
const SET_TARGET_POWER_OPCODE = 0x05
const DEFAULT_ERG_TARGET_WATTS = 180

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'
type PowerPayloadType = 'cycling-power' | 'indoor-bike'
type BluetoothServiceId = number | string

interface BluetoothDeviceFilterLike {
  services?: BluetoothServiceId[]
  namePrefix?: string
}

interface RequestDeviceOptionsLike {
  filters?: BluetoothDeviceFilterLike[]
  optionalServices?: BluetoothServiceId[]
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  value: DataView | null
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<void>
  writeValueWithResponse(value: BufferSource): Promise<void>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(
    characteristic: BluetoothServiceId
  ): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  getPrimaryService(service: BluetoothServiceId): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGattLike {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
}

interface BluetoothDevice extends EventTarget {
  name?: string
  gatt?: BluetoothRemoteGattLike
}

interface NavigatorBluetoothLike {
  requestDevice(options?: RequestDeviceOptionsLike): Promise<BluetoothDevice>
}

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: NavigatorBluetoothLike
}

const BLE_MISSING_MESSAGE =
  'Web Bluetooth is unavailable. Use a Chromium browser over HTTPS (or localhost).'

function getNavigatorBluetooth(): NavigatorBluetoothLike | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator as NavigatorWithBluetooth).bluetooth ?? null
}

function parseCyclingPowerMeasurement(value: DataView): number | null {
  if (value.byteLength < 4) {
    return null
  }

  return value.getInt16(2, true)
}

function parseIndoorBikeData(value: DataView): number | null {
  if (value.byteLength < 2) {
    return null
  }

  const flags = value.getUint16(0, true)
  let offset = 2

  if ((flags & 0x01) === 0) {
    offset += 2
  }
  if (flags & 0x02) {
    offset += 2
  }
  if (flags & 0x04) {
    offset += 2
  }
  if (flags & 0x08) {
    offset += 2
  }
  if (flags & 0x10) {
    offset += 3
  }
  if (flags & 0x20) {
    offset += 2
  }

  if (flags & 0x40) {
    if (value.byteLength < offset + 2) {
      return null
    }
    return value.getInt16(offset, true)
  }

  return null
}

function parseHeartRateMeasurement(value: DataView): number | null {
  if (value.byteLength < 2) {
    return null
  }

  const flags = value.getUint8(0)
  const isUint16 = (flags & 0x01) !== 0

  if (isUint16) {
    if (value.byteLength < 3) {
      return null
    }

    return value.getUint16(1, true)
  }

  return value.getUint8(1)
}

function encodeSetTargetPower(targetWatts: number): Uint8Array {
  const payload = new Uint8Array(3)
  const view = new DataView(payload.buffer)

  payload[0] = SET_TARGET_POWER_OPCODE
  view.setInt16(1, targetWatts, true)
  return payload
}

export type BluetoothDashboardModel = {
  webBluetoothSupported: boolean
  statusMessage: string
  connectionState: ConnectionState
  heartRateConnectionState: ConnectionState
  trainerName: string
  heartRateMonitorName: string
  livePowerWatts: number | null
  heartRateBpm: number | null
  ergTargetWatts: number
  setErgTargetWatts: (value: number) => void
  connectTrainer: () => Promise<void>
  disconnectTrainer: () => void
  connectHeartRateMonitor: () => Promise<void>
  disconnectHeartRateMonitor: () => void
  setErgTarget: () => Promise<void>
}

type UseTrainerBluetoothOptions = {
  initialErgTargetWatts?: number
}

function normalizeErgTarget(value: number | undefined): number {
  const candidate = Math.round(value ?? DEFAULT_ERG_TARGET_WATTS)
  if (!Number.isFinite(candidate)) {
    return DEFAULT_ERG_TARGET_WATTS
  }
  return Math.min(2000, Math.max(0, candidate))
}

export function useTrainerBluetooth(
  options: UseTrainerBluetoothOptions = {}
): BluetoothDashboardModel {
  const initialErgTargetWatts = normalizeErgTarget(options.initialErgTargetWatts)
  const [webBluetoothSupported, setWebBluetoothSupported] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [heartRateConnectionState, setHeartRateConnectionState] =
    useState<ConnectionState>('idle')
  const [statusMessage, setStatusMessage] = useState(
    'Connect your smart trainer to start receiving live power.'
  )
  const [trainerName, setTrainerName] = useState('No trainer connected')
  const [heartRateMonitorName, setHeartRateMonitorName] = useState(
    'No HR monitor connected'
  )
  const [livePowerWatts, setLivePowerWatts] = useState<number | null>(null)
  const [heartRateBpm, setHeartRateBpm] = useState<number | null>(null)
  const [ergTargetWatts, setErgTargetWatts] = useState(initialErgTargetWatts)

  const trainerDeviceRef = useRef<BluetoothDevice | null>(null)
  const powerCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const controlCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const hrDeviceRef = useRef<BluetoothDevice | null>(null)
  const hrCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const payloadTypeRef = useRef<PowerPayloadType>('cycling-power')

  useEffect(() => {
    setWebBluetoothSupported(Boolean(getNavigatorBluetooth()))
  }, [])

  useEffect(() => {
    setErgTargetWatts(initialErgTargetWatts)
  }, [initialErgTargetWatts])

  const handlePowerNotification = useCallback((event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null
    const value = characteristic?.value
    if (!value) {
      return
    }

    const watts =
      payloadTypeRef.current === 'cycling-power'
        ? parseCyclingPowerMeasurement(value)
        : parseIndoorBikeData(value)

    if (watts === null || Number.isNaN(watts)) {
      return
    }

    setLivePowerWatts(Math.max(0, Math.round(watts)))
  }, [])

  const handleHeartRateNotification = useCallback((event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null
    const value = characteristic?.value
    if (!value) {
      return
    }

    const bpm = parseHeartRateMeasurement(value)
    if (bpm === null || Number.isNaN(bpm)) {
      return
    }

    setHeartRateBpm(Math.max(0, Math.round(bpm)))
  }, [])

  const handleTrainerDisconnected = useCallback(() => {
    if (powerCharacteristicRef.current) {
      powerCharacteristicRef.current.removeEventListener(
        'characteristicvaluechanged',
        handlePowerNotification
      )
      void powerCharacteristicRef.current.stopNotifications().catch(() => {})
    }

    powerCharacteristicRef.current = null
    controlCharacteristicRef.current = null
    trainerDeviceRef.current = null
    setConnectionState('idle')
    setTrainerName('No trainer connected')
    setLivePowerWatts(null)
    setStatusMessage('Trainer disconnected.')
  }, [handlePowerNotification])

  const handleHeartRateMonitorDisconnected = useCallback(() => {
    if (hrCharacteristicRef.current) {
      hrCharacteristicRef.current.removeEventListener(
        'characteristicvaluechanged',
        handleHeartRateNotification
      )
      void hrCharacteristicRef.current.stopNotifications().catch(() => {})
    }

    hrCharacteristicRef.current = null
    hrDeviceRef.current = null
    setHeartRateConnectionState('idle')
    setHeartRateMonitorName('No HR monitor connected')
    setHeartRateBpm(null)
  }, [handleHeartRateNotification])

  const writeFtmsCommand = useCallback(async (payload: Uint8Array) => {
    const controlCharacteristic = controlCharacteristicRef.current
    if (!controlCharacteristic) {
      throw new Error('No FTMS control point available for this trainer.')
    }

    const commandBuffer = new ArrayBuffer(payload.byteLength)
    new Uint8Array(commandBuffer).set(payload)
    await controlCharacteristic.writeValueWithResponse(commandBuffer)
  }, [])

  const connectTrainer = useCallback(async () => {
    const bluetooth = getNavigatorBluetooth()
    if (!bluetooth) {
      setConnectionState('error')
      setStatusMessage(BLE_MISSING_MESSAGE)
      return
    }

    try {
      setConnectionState('connecting')
      setStatusMessage('Searching for smart trainers...')

      const device = await bluetooth.requestDevice({
        filters: [
          { services: [CYCLING_POWER_SERVICE_UUID] },
          { services: [FITNESS_MACHINE_SERVICE_UUID] },
          { namePrefix: 'KICKR' },
          { namePrefix: 'Wahoo' },
        ],
        optionalServices: [CYCLING_POWER_SERVICE_UUID, FITNESS_MACHINE_SERVICE_UUID],
      })

      const server = await device.gatt?.connect()
      if (!server) {
        throw new Error('Unable to open GATT connection.')
      }

      let powerCharacteristic: BluetoothRemoteGATTCharacteristic

      try {
        const cyclingPowerService = await server.getPrimaryService(
          CYCLING_POWER_SERVICE_UUID
        )
        powerCharacteristic = await cyclingPowerService.getCharacteristic(
          CYCLING_POWER_MEASUREMENT_UUID
        )
        payloadTypeRef.current = 'cycling-power'
      } catch {
        const fitnessMachineService = await server.getPrimaryService(
          FITNESS_MACHINE_SERVICE_UUID
        )
        powerCharacteristic = await fitnessMachineService.getCharacteristic(
          INDOOR_BIKE_DATA_UUID
        )
        payloadTypeRef.current = 'indoor-bike'
      }

      powerCharacteristic.addEventListener(
        'characteristicvaluechanged',
        handlePowerNotification
      )
      await powerCharacteristic.startNotifications()
      powerCharacteristicRef.current = powerCharacteristic

      device.addEventListener('gattserverdisconnected', handleTrainerDisconnected)
      trainerDeviceRef.current = device
      setTrainerName(device.name ?? 'Unnamed trainer')
      setConnectionState('connected')
      setStatusMessage('Connected. Streaming live power data.')

      try {
        const fitnessMachineService = await server.getPrimaryService(
          FITNESS_MACHINE_SERVICE_UUID
        )
        const controlPoint = await fitnessMachineService.getCharacteristic(
          FITNESS_MACHINE_CONTROL_POINT_UUID
        )
        controlCharacteristicRef.current = controlPoint
        await writeFtmsCommand(Uint8Array.of(REQUEST_CONTROL_OPCODE))
      } catch {
        controlCharacteristicRef.current = null
        setStatusMessage(
          'Connected for power reading. FTMS control point not available in this session.'
        )
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to connect to trainer.'
      setConnectionState('error')
      setStatusMessage(message)
    }
  }, [
    handlePowerNotification,
    handleTrainerDisconnected,
    writeFtmsCommand,
  ])

  const disconnectTrainer = useCallback(() => {
    const device = trainerDeviceRef.current

    if (powerCharacteristicRef.current) {
      powerCharacteristicRef.current.removeEventListener(
        'characteristicvaluechanged',
        handlePowerNotification
      )
      void powerCharacteristicRef.current.stopNotifications().catch(() => {})
      powerCharacteristicRef.current = null
    }

    controlCharacteristicRef.current = null

    if (device) {
      device.removeEventListener('gattserverdisconnected', handleTrainerDisconnected)
      if (device.gatt?.connected) {
        device.gatt.disconnect()
      }
    }

    trainerDeviceRef.current = null
    setConnectionState('idle')
    setTrainerName('No trainer connected')
    setLivePowerWatts(null)
    setStatusMessage('Trainer disconnected.')
  }, [handlePowerNotification, handleTrainerDisconnected])

  const connectHeartRateMonitor = useCallback(async () => {
    const bluetooth = getNavigatorBluetooth()
    if (!bluetooth) {
      setHeartRateConnectionState('error')
      return
    }

    try {
      setHeartRateConnectionState('connecting')

      const device = await bluetooth.requestDevice({
        filters: [
          { services: [HEART_RATE_SERVICE_UUID] },
          { namePrefix: 'TICKR' },
          { namePrefix: 'Wahoo' },
          { namePrefix: 'HR' },
        ],
        optionalServices: [HEART_RATE_SERVICE_UUID],
      })

      const server = await device.gatt?.connect()
      if (!server) {
        throw new Error('Unable to open heart rate monitor connection.')
      }

      const hrService = await server.getPrimaryService(HEART_RATE_SERVICE_UUID)
      const hrCharacteristic = await hrService.getCharacteristic(
        HEART_RATE_MEASUREMENT_UUID
      )

      hrCharacteristic.addEventListener(
        'characteristicvaluechanged',
        handleHeartRateNotification
      )
      await hrCharacteristic.startNotifications()
      hrCharacteristicRef.current = hrCharacteristic

      device.addEventListener(
        'gattserverdisconnected',
        handleHeartRateMonitorDisconnected
      )
      hrDeviceRef.current = device
      setHeartRateMonitorName(device.name ?? 'Unnamed HR monitor')
      setHeartRateConnectionState('connected')
    } catch {
      setHeartRateConnectionState('error')
    }
  }, [
    handleHeartRateMonitorDisconnected,
    handleHeartRateNotification,
  ])

  const disconnectHeartRateMonitor = useCallback(() => {
    const device = hrDeviceRef.current

    if (hrCharacteristicRef.current) {
      hrCharacteristicRef.current.removeEventListener(
        'characteristicvaluechanged',
        handleHeartRateNotification
      )
      void hrCharacteristicRef.current.stopNotifications().catch(() => {})
      hrCharacteristicRef.current = null
    }

    if (device) {
      device.removeEventListener(
        'gattserverdisconnected',
        handleHeartRateMonitorDisconnected
      )
      if (device.gatt?.connected) {
        device.gatt.disconnect()
      }
    }

    hrDeviceRef.current = null
    setHeartRateConnectionState('idle')
    setHeartRateMonitorName('No HR monitor connected')
    setHeartRateBpm(null)
  }, [handleHeartRateMonitorDisconnected, handleHeartRateNotification])

  const setErgTarget = useCallback(async () => {
    const target = Math.round(ergTargetWatts)
    if (!Number.isFinite(target) || target < 0 || target > 2000) {
      setStatusMessage('Choose a target between 0 and 2000 watts.')
      return
    }

    if (!controlCharacteristicRef.current) {
      setStatusMessage('ERG control unavailable: no FTMS control point found.')
      return
    }

    try {
      await writeFtmsCommand(encodeSetTargetPower(target))
      setStatusMessage(`ERG target set to ${target} W.`)
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to set ERG target.'
      setStatusMessage(message)
    }
  }, [ergTargetWatts, writeFtmsCommand])

  useEffect(() => {
    return () => {
      const trainerDevice = trainerDeviceRef.current
      const hrDevice = hrDeviceRef.current

      if (powerCharacteristicRef.current) {
        powerCharacteristicRef.current.removeEventListener(
          'characteristicvaluechanged',
          handlePowerNotification
        )
      }

      if (hrCharacteristicRef.current) {
        hrCharacteristicRef.current.removeEventListener(
          'characteristicvaluechanged',
          handleHeartRateNotification
        )
      }

      if (trainerDevice?.gatt?.connected) {
        trainerDevice.gatt.disconnect()
      }
      if (hrDevice?.gatt?.connected) {
        hrDevice.gatt.disconnect()
      }
    }
  }, [handleHeartRateNotification, handlePowerNotification])

  return {
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
  }
}
