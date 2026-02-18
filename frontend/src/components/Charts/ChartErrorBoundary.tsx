import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for chart components so a single chart failure doesn't crash the app.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="rounded-xl border border-amber-500/30 bg-gray-900/80 p-6 flex flex-col gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium">Chart failed to load</span>
          </div>
          <p className="text-sm text-gray-400">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="self-start px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
