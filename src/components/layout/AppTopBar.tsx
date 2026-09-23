import { APP_VIEWS } from "../../app-shell";
import type { AppView } from "../../app-shell";

export function AppTopBar({
  activeView,
  onChangeView,
  libraryStatus,
  libraryActions,
}: {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  libraryStatus?: {
    connectionStatus: "unknown" | "ready" | "read_only" | "write_blocked";
    connectionDetail: string;
    libraryPath: string;
    pendingSyncCount: number;
    workerMessage: string;
  };
  libraryActions?: {
    isConnected: boolean;
    onConnectOrRefresh: () => void;
  };
}) {
  const showLibraryStatus = activeView === "library" && libraryStatus;
  const connectionStatusLabel = libraryStatus
    ? libraryStatus.connectionStatus === "ready"
      ? "Connected"
      : libraryStatus.connectionStatus === "read_only"
        ? "Read Only"
        : libraryStatus.connectionStatus === "write_blocked"
          ? "Write Blocked"
          : "Not Connected"
    : "Not Connected";
  const pathLabel = libraryStatus?.libraryPath
    ? `Library: ${libraryStatus.libraryPath}`
    : "Library not configured";
  const isLibraryOnline = libraryActions?.isConnected ?? (
    libraryStatus?.connectionStatus === "ready" && Boolean(libraryStatus.libraryPath)
  );

  return (
    <header className="app-topbar">
      <div className="app-topbar-brand">
        <div className="app-topbar-brand-copy">
          <p className="eyebrow">DT Manager</p>
          <div className="app-topbar-title-row">
            <h1>DT Manager</h1>
            <div className="app-topbar-connection-controls">
              {libraryActions ? (
                <button
                  type="button"
                  className={libraryActions.isConnected ? "ghost" : ""}
                  onClick={libraryActions.onConnectOrRefresh}
                >
                  {libraryActions.isConnected ? "Disconnect Library" : "Connect Library"}
                </button>
              ) : null}
              <span
                className={`status-pill topbar-online-pill ${isLibraryOnline ? "topbar-online-pill-ready" : "topbar-online-pill-offline"}`}
                aria-label={`Library is ${isLibraryOnline ? "online" : "offline"}`}
              >
                {isLibraryOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <p className="app-topbar-copy">
            {showLibraryStatus ? pathLabel : "Library-first metadata, tagging, series, and export workflow."}
          </p>
        </div>
        <div className="app-topbar-primary">
          <nav className="app-view-nav" aria-label="Primary navigation">
            {APP_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                className={activeView === view.id ? "app-view-button app-view-button-active" : "app-view-button ghost"}
                onClick={() => onChangeView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </nav>
          <div className="app-topbar-meta">
            {showLibraryStatus ? (
              <div className="app-topbar-status-cluster" aria-label="Library status">
                {/* <span className={`status-pill status-${libraryStatus.connectionStatus}`}>
                  {connectionStatusLabel}
                </span> */}
                <span className="topbar-status-item">
                  {libraryStatus.pendingSyncCount} pending sync items
                </span>
                <span className="topbar-status-item topbar-status-item-muted">
                  {libraryStatus.workerMessage}
                </span>
              </div>
            ) : (
              <p className="app-topbar-copy app-topbar-copy-compact">
                
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
