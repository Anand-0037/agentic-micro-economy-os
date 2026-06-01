import { Component, type ErrorInfo, type ReactNode } from "react";

type LocalErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type LocalErrorBoundaryState = {
  hasError: boolean;
};

export class LocalErrorBoundary extends Component<
  LocalErrorBoundaryProps,
  LocalErrorBoundaryState
> {
  state: LocalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LocalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error("[LocalErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="neo-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{this.props.title ?? "This section failed to load."}</p>
          <p className="mt-1 text-xs">
            The rest of the console remains available. Refresh to retry this panel.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
