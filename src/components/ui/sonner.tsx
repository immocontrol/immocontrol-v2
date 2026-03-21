import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Badge zeigt Gesamtzahl der Toasts auf dem vordersten Toast (nur wenn > 1) */
function ToastCountBadge() {
  try {
    const { toasts } = useSonner();
    const count = Array.isArray(toasts) ? toasts.length : 0;
    if (count <= 1) return null;
    return (
      <span className="toast-count-badge" aria-hidden>
        {count > 99 ? "99+" : count}
      </span>
    );
  } catch {
    return null;
  }
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group toaster-stacked"
        gap={4}
        visibleToasts={6}
        expand={false}
        toastOptions={{
          duration: 4000,
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-md group-[.toaster]:rounded-xl",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      <ToastCountBadge />
    </>
  );
};

export { Toaster, toast };
