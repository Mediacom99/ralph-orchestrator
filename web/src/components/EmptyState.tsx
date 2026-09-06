import { PlusIcon } from "./icons";

interface EmptyStateProps {
  onNewLoop: () => void;
}

export function EmptyState({ onNewLoop }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <PlusIcon className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">No loops yet</h3>
      <p className="text-sm text-gray-500 mb-6 text-center">
        Create your first loop to get started
      </p>
      <button
        onClick={onNewLoop}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white"
      >
        Create Loop
      </button>
    </div>
  );
}
