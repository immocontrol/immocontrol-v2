import { useState, useMemo } from "react";
import { Calendar, Download, Apple, Chrome, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: number;
  completed: boolean;
  project: string;
}

interface TodoCalendarSyncProps {
  todos: Todo[];
}

const PRIORITY_LABEL: Record<number, string> = {
  1: "Dringend",
  2: "Hoch",
  3: "Mittel",
  4: "Normal",
};

const pad = (n: number) => String(n).padStart(2, "0");

function toIcsDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(dateStr);
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
  }
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function generateIcs(todos: Todo[]): string {
  const withDates = todos.filter(t => !t.completed && t.due_date);
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}00Z`;

  const events = withDates.map(t => {
    const isAllDay = !t.due_time;
    const dtStart = toIcsDate(t.due_date!, t.due_time);
    const dtEnd = isAllDay
      ? (() => {
          const d = new Date(t.due_date!);
          d.setDate(d.getDate() + 1);
          return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        })()
      : (() => {
          const [h, m] = (t.due_time || "00:00").split(":").map(Number);
          const d = new Date(t.due_date!);
          const end = new Date(d);
          end.setHours(h, m + 30);
          /* Use end Date for date portion — handles midnight rollover (e.g. 23:45 + 30min → 00:15 next day) */
          const endDateStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
          return toIcsDate(endDateStr, `${pad(end.getHours())}:${pad(end.getMinutes())}`);
        })();

    const priorityMap: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 9 };
    const priority = priorityMap[t.priority] ?? 9;
    const description = [
      t.description ? t.description.replace(/\n/g, "\\n") : "",
      t.project ? `Projekt: ${t.project}` : "",
      `Priorität: ${PRIORITY_LABEL[t.priority] ?? "Normal"}`,
    ]
      .filter(Boolean)
      .join("\\n");

    const uid = `${t.id}@immocontrol`;

    if (isAllDay) {
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${t.title.replace(/,/g, "\\,")}`,
        description ? `DESCRIPTION:${description}` : "",
        `PRIORITY:${priority}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    }

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${t.title.replace(/,/g, "\\,")}`,
      description ? `DESCRIPTION:${description}` : "",
      `PRIORITY:${priority}`,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ImmoControl//Aufgaben//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ImmoControl Aufgaben",
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(todos: Todo[]) {
  const ics = generateIcs(todos);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "immocontrol-aufgaben.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/** Build a Google Calendar event URL (no OAuth needed) */
function buildGoogleCalendarUrl(todo: Todo): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", todo.title);
  if (todo.due_date) {
    if (todo.due_time) {
      const start = toIcsDate(todo.due_date, todo.due_time);
      const [h, m] = todo.due_time.split(":").map(Number);
      const endDate = new Date(todo.due_date);
      endDate.setHours(h, m + 30);
      const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
      params.set("dates", `${start}/${end}`);
    } else {
      const d = new Date(todo.due_date);
      const s = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const e = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
      params.set("dates", `${s}/${e}`);
    }
  }
  const details = [todo.description, todo.project ? `Projekt: ${todo.project}` : "", `Prioritaet: ${PRIORITY_LABEL[todo.priority] ?? "Normal"}`].filter(Boolean).join("\n");
  params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Build an Outlook.com calendar event URL (no OAuth needed) */
function buildOutlookUrl(todo: Todo): string {
  const params = new URLSearchParams();
  params.set("path", "/calendar/action/compose");
  params.set("rru", "addevent");
  params.set("subject", todo.title);
  if (todo.due_date) {
    if (todo.due_time) {
      params.set("startdt", `${todo.due_date}T${todo.due_time}:00`);
      const [h, m] = todo.due_time.split(":").map(Number);
      const endDate = new Date(todo.due_date);
      endDate.setHours(h, m + 30);
      params.set("enddt", `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`);
    } else {
      params.set("startdt", todo.due_date);
      params.set("allday", "true");
    }
  }
  const body = [todo.description, todo.project ? `Projekt: ${todo.project}` : ""].filter(Boolean).join("\n");
  params.set("body", body);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

const PROVIDERS = [
  {
    key: "google",
    label: "Google Kalender",
    description: "Direkt in Google Kalender einfuegen",
    icon: Chrome,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    hasDirectLink: true,
    buildUrl: buildGoogleCalendarUrl,
  },
  {
    key: "outlook",
    label: "Outlook / Microsoft 365",
    description: "Direkt in Outlook Kalender einfuegen",
    icon: OutlookIcon,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    hasDirectLink: true,
    buildUrl: buildOutlookUrl,
  },
  {
    key: "apple",
    label: "Apple Kalender / iCal",
    description: ".ics-Datei herunterladen und oeffnen",
    icon: Apple,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    hasDirectLink: false,
    buildUrl: null as ((t: Todo) => string) | null,
  },
];

const TodoCalendarSync = ({ todos }: TodoCalendarSyncProps) => {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const exportable = useMemo(
    () => todos.filter(t => !t.completed && t.due_date),
    [todos]
  );

  const handleDirectSync = (providerKey: string, buildUrl: ((t: Todo) => string) | null) => {
    if (!buildUrl || exportable.length === 0) return;
    setSyncing(providerKey);
    if (exportable.length <= 3) {
      exportable.forEach((t, i) => {
        setTimeout(() => window.open(buildUrl(t), "_blank", "noopener"), i * 400);
      });
      toast.success(`${exportable.length} Aufgabe${exportable.length > 1 ? "n" : ""} im Kalender geoeffnet`);
    } else {
      // Open first 3 directly + download ICS for rest
      for (let i = 0; i < 3; i++) {
        setTimeout(() => window.open(buildUrl(exportable[i]), "_blank", "noopener"), i * 400);
      }
      downloadIcs(todos);
      toast.info(`3 direkt geoeffnet + .ics-Datei fuer alle ${exportable.length} heruntergeladen`);
    }
    setTimeout(() => setSyncing(null), 1000);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Kalender-Sync</span>
        <span className="sm:hidden">Sync</span>
        {exportable.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold">
            {exportable.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Kalender-Synchronisation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Synchronisiere {exportable.length} Aufgabe{exportable.length !== 1 ? "n" : ""} mit deinem Kalender.
              Google und Outlook oeffnen direkt — fuer Apple wird eine .ics-Datei heruntergeladen.
            </p>

            <div className="space-y-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const isSyncing = syncing === p.key;
                return (
                  <button
                    key={p.key}
                    className="w-full flex items-center gap-3 px-4 py-3 surface-section hover:bg-secondary/50 transition-all group"
                    onClick={() => {
                      if (p.hasDirectLink && p.buildUrl) {
                        handleDirectSync(p.key, p.buildUrl);
                      } else {
                        downloadIcs(todos);
                        toast.success(".ics-Datei heruntergeladen");
                      }
                    }}
                    disabled={exportable.length === 0 || isSyncing}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.bg}`}>
                      {isSyncing ? (
                        <RefreshCw className={`h-4 w-4 ${p.color} animate-spin`} />
                      ) : (
                        <Icon className={`h-4 w-4 ${p.color}`} />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    {p.hasDirectLink ? (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </div>

            {exportable.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-2">
                Keine offenen Aufgaben mit Faelligkeitsdatum vorhanden.
              </p>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => { downloadIcs(todos); toast.success(".ics heruntergeladen"); }}
              >
                <Download className="h-4 w-4" />
                .ics herunterladen ({exportable.length})
              </Button>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Kostenlos — keine Anmeldung erforderlich
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Simple Outlook-style icon */
function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 4v16" />
    </svg>
  );
}

export default TodoCalendarSync;
