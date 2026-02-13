import { ConnectionState } from "@/hooks/useTrainerBluetooth";
import "./StatusBar.css";

type StatusBarProps = {
  connectionState: ConnectionState;
  statusMessage: string;
};

export function StatusBar({ connectionState, statusMessage }: StatusBarProps) {
  return (
    <div className="cp-status-bar">
      <span
        className={
          connectionState === "connected"
            ? "cp-status-indicator cp-status-indicator--active"
            : "cp-status-indicator"
        }
      />
      <p className="cp-status-text">{statusMessage}</p>
    </div>
  );
}
