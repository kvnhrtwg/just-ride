import { ConnectionState } from "@/hooks/useTrainerBluetooth";
import "./MetricCards.scss";

type MetricCardsProps = {
  livePowerWatts: number | null;
  cadenceRpm: number | null;
  trainerName: string;
  connectionState: ConnectionState;
  heartRateBpm: number | null;
  heartRateMonitorName: string;
  heartRateConnectionState: ConnectionState;
};

function badgeClass(state: string): string {
  if (state === "connected") return "cp-badge cp-badge--connected";
  if (state === "connecting") return "cp-badge cp-badge--connecting";
  if (state === "error") return "cp-badge cp-badge--error";
  return "cp-badge";
}

export function MetricCards({
  livePowerWatts,
  cadenceRpm,
  trainerName,
  connectionState,
  heartRateBpm,
  heartRateMonitorName,
  heartRateConnectionState,
}: MetricCardsProps) {
  return (
    <section className="cp-metrics">
      <article className="cp-card cp-card--power">
        <p className="cp-card-label">Live Power</p>
        <h2 className="cp-card-value cp-card-value--power">
          <span className="cp-big-number">{livePowerWatts ?? "--"}</span>
          <span className="cp-unit">W</span>
        </h2>
        <p className="cp-inline-metric">
          <span className="cp-inline-metric-label">Cadence</span>
          <span className="cp-inline-metric-value">{cadenceRpm ?? "--"} RPM</span>
        </p>
        <span className="cp-device-name">{trainerName}</span>
        <span className={badgeClass(connectionState)}>{connectionState}</span>
      </article>

      <article className="cp-card cp-card--hr">
        <p className="cp-card-label">Heart Rate</p>
        <h2 className="cp-card-value cp-card-value--hr">
          <span className="cp-big-number">{heartRateBpm ?? "--"}</span>
          <span className="cp-unit">BPM</span>
        </h2>
        <span className="cp-device-name">{heartRateMonitorName}</span>
        <span className={badgeClass(heartRateConnectionState)}>
          {heartRateConnectionState}
        </span>
      </article>
    </section>
  );
}
