
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
    console.error("Error caught by ErrorBoundary:", error);
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    console.log("Resetting error boundary state");
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
      console.log("Called onReset handler");
    } else {
      console.log("No onReset handler provided, just clearing error state");
    }
  };

  private handleReload = () => {
    console.log("Performing full page reload");
    window.location.reload();
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
            <div className="text-sm text-red-700 mb-4 max-w-lg mx-auto overflow-auto">
              <p className="font-medium">Erro: {this.state.error.toString()}</p>
              {this.state.errorInfo && (
                <details className="mt-2 text-left">
                  <summary className="cursor-pointer text-red-800">Ver detalhes do erro</summary>
                  <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={this.handleRetry}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button
              onClick={this.handleReload}
              variant="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
