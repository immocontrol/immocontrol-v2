/**
 * UX-17: Breadcrumb Navigation
 * Contextual breadcrumbs for deep navigation paths.
 */
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { ROUTES } from "@/lib/routes";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <li>
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            aria-label="Startseite"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            {item.href && idx < items.length - 1 ? (
              <Link to={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
