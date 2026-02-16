import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// M2: Catch unhandled errors to prevent blank-screen crashes.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto mt-16 p-6 bg-red-900/30 border border-red-800 rounded-lg text-center">
          <h2 className="text-lg font-semibold text-red-300 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-red-400 mb-4">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm cursor-pointer"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
