import { SettingsIcon, PlusIcon } from "./icons";

interface HeaderProps {
  wsConnected: boolean;
  onNewLoop: () => void;
  onSettings: () => void;
}

export function Header({ wsConnected, onNewLoop, onSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">
            <span className="sm:hidden">Ralph</span>
            <span className="hidden sm:inline">Ralph Orchestrator</span>
          </h1>
          <span
            className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-red-400"}`}
            title={wsConnected ? "Connected" : "Disconnected"}
          />
          <span className="hidden sm:inline text-xs text-gray-500">
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSettings}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onNewLoop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">New Loop</span>
          </button>
        </div>
      </div>
    </header>
  );
}
