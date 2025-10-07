
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in visualization canvas:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-900/20 p-4">
            <h1 className="text-xl font-bold mb-2">Rendering Error</h1>
            <p className="text-base-content/80 mb-4">The 3D visualization has crashed.</p>
            <pre className="text-xs bg-base-300 p-2 rounded w-full max-w-md overflow-auto">
                {this.state.error?.message || 'An unknown error occurred.'}
            </pre>
            <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-4 px-4 py-2 rounded-md font-semibold transition-colors duration-200 bg-primary text-base-100 hover:bg-primary/80"
            >
                Try to recover
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}
