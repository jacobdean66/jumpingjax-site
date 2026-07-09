"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type SocialPostAdminErrorFallbackProps = {
  postId: string;
  componentName: string;
  errorMessage: string;
  onRetry: () => void;
};

export function SocialPostAdminErrorFallback({
  postId,
  componentName,
  errorMessage,
  onRetry,
}: SocialPostAdminErrorFallbackProps) {
  return (
    <div
      className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm"
      role="alert"
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-800">
        Component error
      </p>
      <dl className="mt-2 space-y-1 font-semibold">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-black text-rose-900">Post ID:</dt>
          <dd className="break-all">{postId}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-black text-rose-900">Component:</dt>
          <dd>{componentName}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-black text-rose-900">Error:</dt>
          <dd>{errorMessage}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-9 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white"
        >
          Retry
        </button>
        <p className="text-xs font-semibold text-rose-900">
          Continue working with remaining posts.
        </p>
      </div>
    </div>
  );
}

type Props = {
  postId: string;
  componentName: string;
  children: ReactNode;
  className?: string;
};

type State = {
  error: Error | null;
  retryKey: number;
};

export class SocialPostAdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[SocialPostAdminErrorBoundary:${this.props.componentName}] post ${this.props.postId}`,
      error,
      info.componentStack,
    );
  }

  handleRetry = () => {
    this.setState((current) => ({
      error: null,
      retryKey: current.retryKey + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return (
        <SocialPostAdminErrorFallback
          postId={this.props.postId}
          componentName={this.props.componentName}
          errorMessage={this.state.error.message || "Unexpected render error"}
          onRetry={this.handleRetry}
        />
      );
    }

    return (
      <div key={this.state.retryKey} className={this.props.className}>
        {this.props.children}
      </div>
    );
  }
}
