/**
 * #8: Granular Error Boundaries per section.
 * Wraps individual dashboard widgets so a crash in one doesn't take down the whole page.
 */
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /* FIX-11: Removed console.warn — errors are displayed in the fallback UI.
   * In production, error reporting should go to a service like Sentry. */
  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Intentionally empty — error is stored in state and shown in fallback UI
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="gradient-card rounded-xl border border-border p-4 flex flex-col items-center justify-center min-h-[120px] text-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {this.props.name || "Widget"} konnte nicht geladen werden
          </p>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={this.handleRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Erneut versuchen
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default WidgetErrorBoundary;
