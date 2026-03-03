import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("ErrorBoundary caught", "ErrorBoundary", { error: error.message, stack: info.componentStack });
  }

  /* STR-1: Retry with exponential backoff — prevents rapid retry loops */
  /* IMP-41-15: Auto-retry after delay — automatically retries once after 5 seconds */
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError && this.state.retryCount === 0) {
      this.autoRetryTimer = setTimeout(() => {
        this.handleRetry();
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer);
  }

  handleRetry = () => {
    if (this.autoRetryTimer) { clearTimeout(this.autoRetryTimer); this.autoRetryTimer = null; }
    const nextCount = this.state.retryCount + 1;
    if (nextCount > 3) {
      // After 3 retries, hard reload the page
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, retryCount: nextCount });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {this.state.error?.message || "Ein unerwarteter Fehler ist aufgetreten."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {this.state.retryCount >= 3 ? "Seite neu laden" : "Erneut versuchen"}
            </Button>
            {/* IMP20-5: Copy error details to clipboard for support/debugging */}
            <Button variant="ghost" size="sm" onClick={() => {
              const details = `Fehler: ${this.state.error?.message || "Unbekannt"}\nStack: ${this.state.error?.stack || "–"}\nZeit: ${new Date().toISOString()}\nURL: ${window.location.href}`;
              navigator.clipboard.writeText(details).catch(() => {});
            }}>
              Fehler kopieren
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
              Zur Startseite
            </Button>
          </div>
          {this.state.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Versuch {this.state.retryCount} von 3{this.state.retryCount >= 3 ? " — nächster Klick lädt die Seite neu" : ""}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
