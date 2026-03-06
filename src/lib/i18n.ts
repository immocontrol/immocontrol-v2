/**
 * #10: i18n Multi-Language Support — Lightweight translation system.
 * Uses a simple key-value approach with German as default language.
 * No external dependencies needed — keeps bundle small.
 */

export type Locale = "de" | "en";

const translations: Record<Locale, Record<string, string>> = {
  de: {
    // Navigation
    "nav.portfolio": "Portfolio",
    "nav.dashboard": "Dashboard",
    "nav.loans": "Darlehen",
    "nav.rent": "Mietübersicht",
    "nav.contracts": "Verträge",
    "nav.contacts": "Kontakte",
    "nav.todos": "Aufgaben",
    "nav.reports": "Berichte",
    "nav.crm": "CRM",
    "nav.deals": "Deals",
    "nav.documents": "Dokumente",
    "nav.maintenance": "Wartung",
    "nav.settings": "Einstellungen",
    "nav.forecast": "Prognose",
    "nav.analysis": "Analyse",
    "nav.ai": "ImmoAI",
    "nav.nebenkosten": "Nebenkosten",

    // Common actions
    "action.save": "Speichern",
    "action.cancel": "Abbrechen",
    "action.delete": "Löschen",
    "action.edit": "Bearbeiten",
    "action.add": "Hinzufügen",
    "action.search": "Suchen",
    "action.export": "Exportieren",
    "action.import": "Importieren",
    "action.filter": "Filtern",
    "action.back": "Zurück",
    "action.close": "Schließen",
    "action.confirm": "Bestätigen",
    "action.undo": "Rückgängig",
    "action.refresh": "Aktualisieren",
    "action.share": "Teilen",
    "action.copy": "Kopieren",
    "action.download": "Herunterladen",
    "action.upload": "Hochladen",

    // Properties
    "property.title": "Objekte",
    "property.add": "Objekt hinzufügen",
    "property.empty": "Noch keine Objekte",
    "property.empty.desc": "Füge dein erstes Investmentobjekt hinzu",
    "property.type.mfh": "Mehrfamilienhaus",
    "property.type.zfh": "Zweifamilienhaus",
    "property.type.etw": "Eigentumswohnung",
    "property.type.efh": "Einfamilienhaus",
    "property.type.gewerbe": "Gewerbe",

    // Dashboard
    "dashboard.totalValue": "Gesamtwert",
    "dashboard.equity": "Eigenkapital",
    "dashboard.monthlyRent": "Mieteinnahmen/M",
    "dashboard.cashflow": "Cashflow/M",
    "dashboard.yield": "Brutto-Rendite",
    "dashboard.units": "Einheiten",
    "dashboard.ltv": "LTV",
    "dashboard.greeting.morning": "Guten Morgen",
    "dashboard.greeting.afternoon": "Guten Tag",
    "dashboard.greeting.evening": "Guten Abend",

    // Auth
    "auth.login": "Anmelden",
    "auth.logout": "Abmelden",
    "auth.register": "Registrieren",
    "auth.email": "E-Mail",
    "auth.password": "Passwort",
    "auth.forgotPassword": "Passwort vergessen?",

    // Settings
    "settings.title": "Einstellungen",
    "settings.appearance": "Erscheinungsbild",
    "settings.profile": "Profil",
    "settings.password": "Passwort",
    "settings.2fa": "Zwei-Faktor-Authentifizierung",
    "settings.passkeys": "Passkeys",
    "settings.biometric": "Biometrie",
    "settings.devices": "Geräte",
    "settings.defaultPage": "Standardseite",
    "settings.aiChat": "AI Chat",
    "settings.backup": "Daten-Backup",
    "settings.shortcuts": "Tastenkombinationen",
    "settings.telegram": "Telegram",
    "settings.team": "Team",
    "settings.dangerZone": "Gefahrenzone",
    "settings.systemInfo": "System-Info",

    // Status
    "status.active": "Aktiv",
    "status.inactive": "Inaktiv",
    "status.pending": "Ausstehend",
    "status.confirmed": "Bestätigt",
    "status.overdue": "Überfällig",
    "status.cancelled": "Storniert",
    "status.open": "Offen",
    "status.closed": "Geschlossen",

    // Time
    "time.today": "Heute",
    "time.yesterday": "Gestern",
    "time.days": "Tage",
    "time.months": "Monate",
    "time.years": "Jahre",

    // Messages
    "msg.saved": "Gespeichert!",
    "msg.deleted": "Gelöscht!",
    "msg.error": "Fehler",
    "msg.loading": "Laden...",
    "msg.noResults": "Keine Ergebnisse",
    "msg.confirmDelete": "Wirklich löschen?",

    // Empty states (einheitliche Formulierungen)
    "empty.messages": "Noch keine Nachrichten",
    "empty.messages.desc": "Wähle einen Mieter und starte die Konversation",
    "empty.contacts": "Noch keine Kontakte",
    "empty.documents": "Noch keine Dokumente",
    "empty.tasks": "Keine Aufgaben",
    "empty.list": "Noch keine Einträge",
  },

  en: {
    // Navigation
    "nav.portfolio": "Portfolio",
    "nav.dashboard": "Dashboard",
    "nav.loans": "Loans",
    "nav.rent": "Rent Overview",
    "nav.contracts": "Contracts",
    "nav.contacts": "Contacts",
    "nav.todos": "Tasks",
    "nav.reports": "Reports",
    "nav.crm": "CRM",
    "nav.deals": "Deals",
    "nav.documents": "Documents",
    "nav.maintenance": "Maintenance",
    "nav.settings": "Settings",
    "nav.forecast": "Forecast",
    "nav.analysis": "Analysis",
    "nav.ai": "ImmoAI",
    "nav.nebenkosten": "Utility Costs",

    // Common actions
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.add": "Add",
    "action.search": "Search",
    "action.export": "Export",
    "action.import": "Import",
    "action.filter": "Filter",
    "action.back": "Back",
    "action.close": "Close",
    "action.confirm": "Confirm",
    "action.undo": "Undo",
    "action.refresh": "Refresh",
    "action.share": "Share",
    "action.copy": "Copy",
    "action.download": "Download",
    "action.upload": "Upload",

    // Properties
    "property.title": "Properties",
    "property.add": "Add Property",
    "property.empty": "No Properties Yet",
    "property.empty.desc": "Add your first investment property",
    "property.type.mfh": "Multi-Family House",
    "property.type.zfh": "Two-Family House",
    "property.type.etw": "Condominium",
    "property.type.efh": "Single-Family House",
    "property.type.gewerbe": "Commercial",

    // Dashboard
    "dashboard.totalValue": "Total Value",
    "dashboard.equity": "Equity",
    "dashboard.monthlyRent": "Monthly Rent",
    "dashboard.cashflow": "Cashflow/M",
    "dashboard.yield": "Gross Yield",
    "dashboard.units": "Units",
    "dashboard.ltv": "LTV",
    "dashboard.greeting.morning": "Good Morning",
    "dashboard.greeting.afternoon": "Good Afternoon",
    "dashboard.greeting.evening": "Good Evening",

    // Auth
    "auth.login": "Sign In",
    "auth.logout": "Sign Out",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgotPassword": "Forgot Password?",

    // Settings
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.profile": "Profile",
    "settings.password": "Password",
    "settings.2fa": "Two-Factor Authentication",
    "settings.passkeys": "Passkeys",
    "settings.biometric": "Biometrics",
    "settings.devices": "Devices",
    "settings.defaultPage": "Default Page",
    "settings.aiChat": "AI Chat",
    "settings.backup": "Data Backup",
    "settings.shortcuts": "Keyboard Shortcuts",
    "settings.telegram": "Telegram",
    "settings.team": "Team",
    "settings.dangerZone": "Danger Zone",
    "settings.systemInfo": "System Info",

    // Status
    "status.active": "Active",
    "status.inactive": "Inactive",
    "status.pending": "Pending",
    "status.confirmed": "Confirmed",
    "status.overdue": "Overdue",
    "status.cancelled": "Cancelled",
    "status.open": "Open",
    "status.closed": "Closed",

    // Time
    "time.today": "Today",
    "time.yesterday": "Yesterday",
    "time.days": "days",
    "time.months": "months",
    "time.years": "years",

    // Messages
    "msg.saved": "Saved!",
    "msg.deleted": "Deleted!",
    "msg.error": "Error",
    "msg.loading": "Loading...",
    "msg.noResults": "No results",
    "msg.confirmDelete": "Are you sure?",
  },
};

/** Get the current locale from localStorage or default to "de" */
export function getLocale(): Locale {
  try {
    const stored = localStorage.getItem("immocontrol_locale");
    if (stored === "en" || stored === "de") return stored;
  } catch { /* ignore */ }
  return "de";
}

/** Set the locale in localStorage */
export function setLocale(locale: Locale) {
  localStorage.setItem("immocontrol_locale", locale);
  window.dispatchEvent(new Event("locale-changed"));
}

/** Translate a key to the current locale */
export function t(key: string, locale?: Locale): string {
  const lang = locale || getLocale();
  return translations[lang]?.[key] || translations.de[key] || key;
}

/** Get all available locales */
export const AVAILABLE_LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇬🇧" },
];
