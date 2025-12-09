"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Chronicle Error Boundary] Caught error:", error);
    console.error("[Chronicle Error Boundary] Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full border-red-500/50">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                ⚠️ Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Chronicle encountered an unexpected error. Your data is safe in IndexedDB.
              </p>
              
              {this.state.error && (
                <div className="rounded-md bg-red-500/10 p-3 text-xs font-mono overflow-auto max-h-32">
                  <p className="font-bold text-red-600 dark:text-red-400">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} size="sm">
                  Reload Page
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                If this keeps happening, try exporting your data from the Export page, 
                then clear data from Settings and re-import.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
