import { useState } from "react";
import { Calendar, Download, X, Mail, Apple, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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
          return toIcsDate(t.due_date!, `${pad(end.getHours())}:${pad(end.getMinutes())}`);
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

const PROVIDERS = [
  {
    key: "google",
    label: "Google Kalender",
    description: "In Google Kalender importieren",
    icon: Chrome,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    steps: [
      'Lade die .ics-Datei herunter (Button unten)',
      'Öffne Google Kalender auf dem Desktop',
      'Klicke auf das Zahnrad → "Einstellungen"',
      'Wähle "Importieren" und lade die .ics-Datei hoch',
    ],
  },
  {
    key: "outlook",
    label: "Outlook",
    description: "In Microsoft Outlook importieren",
    icon: Mail,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    steps: [
      'Lade die .ics-Datei herunter',
      'Öffne Outlook (Desktop oder Web)',
      'Datei → Öffnen & Exportieren → Importieren',
      'Wähle "iCalendar-Datei importieren" und wähle die Datei',
    ],
  },
  {
    key: "apple",
    label: "Apple Kalender",
    description: "In Apple Kalender importieren",
    icon: Apple,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    steps: [
      'Lade die .ics-Datei herunter',
      'Öffne die Datei — sie wird direkt in Apple Kalender geöffnet',
      'Bestätige den Import mit "Hinzufügen"',
    ],
  },
];

const TodoCalendarSync = ({ todos }: TodoCalendarSyncProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const exportable = todos.filter(t => !t.completed && t.due_date);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Calendar className="h-3.5 w-3.5" />
        Kalender-Export
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
              Aufgaben exportieren
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportiere {exportable.length} Aufgabe{exportable.length !== 1 ? "n" : ""} mit Fälligkeitsdatum als Kalender-Datei (.ics) — kompatibel mit Google Kalender, Outlook und Apple Kalender.
            </p>

            <div className="space-y-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const isOpen = selected === p.key;
                return (
                  <div key={p.key} className="rounded-lg border border-border overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                      onClick={() => setSelected(isOpen ? null : p.key)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.bg}`}>
                        <Icon className={`h-4 w-4 ${p.color}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                      <ChevronIcon open={isOpen} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 bg-secondary/20 space-y-3">
                        <ol className="space-y-1.5">
                          {p.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {exportable.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-2">
                Keine offenen Aufgaben mit Fälligkeitsdatum vorhanden.
              </p>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  downloadIcs(todos);
                  setOpen(false);
                }}
              >
                <Download className="h-4 w-4" />
                .ics-Datei herunterladen ({exportable.length} Aufgabe{exportable.length !== 1 ? "n" : ""})
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export default TodoCalendarSync;
