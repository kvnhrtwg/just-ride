import { type ConnectionState } from "@/hooks/useTrainerBluetooth";
import "./ErgControlStrip.css";

type ErgControlStripProps = {
  ergTargetWatts: number;
  setErgTargetWatts: (value: number) => void;
  setErgTarget: () => Promise<void>;
  connectionState: ConnectionState;
};

export function ErgControlStrip({
  ergTargetWatts,
  setErgTargetWatts,
  setErgTarget,
  connectionState,
}: ErgControlStripProps) {
  return (
    <section className="cp-erg-strip">
      <label className="cp-erg-label" htmlFor="cp-erg-range">
        ERG Target
      </label>
      <div className="cp-erg-controls">
        <input
          id="cp-erg-range"
          className="cp-erg-range"
          type="range"
          min={80}
          max={450}
          step={5}
          value={ergTargetWatts}
          onChange={(e) => setErgTargetWatts(Number(e.target.value))}
        />
        <input
          className="cp-erg-number"
          type="number"
          min={0}
          max={2000}
          step={5}
          value={ergTargetWatts}
          onChange={(e) => setErgTargetWatts(Number(e.target.value))}
        />
        <button
          className="cp-erg-set"
          onClick={setErgTarget}
          disabled={connectionState !== "connected"}
        >
          Set ERG
        </button>
      </div>
    </section>
  );
}
