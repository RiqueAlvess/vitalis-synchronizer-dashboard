
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center my-6">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-1">
            Ocorreu um erro inesperado
          </h3>
          <p className="text-red-600 mb-2">
            Um erro ocorreu ao renderizar esta página.
          </p>
          {this.state.error && (
            <div className="text-sm text-red-700 mb-4 max-w-lg mx-auto overflow-hidden">
              <p className="font-medium">Erro: {this.state.error.toString()}</p>
            </div>
          )}
          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="flex mx-auto items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
