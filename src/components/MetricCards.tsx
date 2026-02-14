import './MetricCards.scss'

type MetricCardsProps = {
  livePowerWatts: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
}

export function MetricCards({
  livePowerWatts,
  cadenceRpm,
  heartRateBpm,
}: MetricCardsProps) {
  return (
    <section className="cp-metrics">
      <article className="cp-card cp-card--power">
        <p className="cp-card-label">Live Power</p>
        <h2 className="cp-card-value cp-card-value--power">
          <span className="cp-big-number">{livePowerWatts ?? '--'}</span>
          <span className="cp-unit">W</span>
        </h2>
      </article>

      <article className="cp-card cp-card--cadence">
        <p className="cp-card-label">Cadence</p>
        <h2 className="cp-card-value cp-card-value--cadence">
          <span className="cp-big-number">{cadenceRpm ?? '--'}</span>
          <span className="cp-unit">RPM</span>
        </h2>
      </article>

      <article className="cp-card cp-card--hr">
        <p className="cp-card-label">Heart Rate</p>
        <h2 className="cp-card-value cp-card-value--hr">
          <span className="cp-big-number">{heartRateBpm ?? '--'}</span>
          <span className="cp-unit">BPM</span>
        </h2>
      </article>
    </section>
  )
}
