# Formular-Optimierungen – Checkliste

Bei allen Formularen und Dialogen mit Nutzereingabe sollten folgende Punkte beachtet werden.

## Pflicht-Checkliste

| Punkt | Beschreibung |
|-------|--------------|
| **Submit bei Ladezustand deaktivieren** | Submit-Button mit `disabled={isSubmitting}` bzw. `disabled={mutation.isPending}` und ggf. Beschriftung „Wird gespeichert…“ / „Wird angelegt…“. Verhindert Doppelklicks und zeigt Feedback. |
| **Label oder aria-label** | Jedes Eingabefeld hat ein zugehöriges `<Label htmlFor="id">` oder `aria-label`. Select/Combobox: Label sichtbar oder über `aria-label` am Trigger. |
| **id / htmlFor** | Input und Label über `id` am Input und `htmlFor` am Label verknüpfen (Barrierefreiheit, Fokus). |
| **Native Form wo möglich** | `<form onSubmit={handleSubmit}>` und Button `type="submit"`, damit Enter zum Absenden führt. Bei mehrstufigen Dialogen: Enter auf Zwischenschritt optional (z. B. „Weiter“). |
| **Validierung** | Mindestens Pflichtfelder prüfen (inline oder Zod). Fehlermeldung unter dem Feld oder als Toast; Fokus auf erstes ungültiges Feld setzen. |
| **Loading-State bei gefährlichen Aktionen** | Bei „Konto löschen“, „Endgültig löschen“ etc.: Button während Request deaktivieren und „Wird gelöscht…“ anzeigen; Abbrechen deaktivieren. |

## Bereits umgesetzt (Beispiele)

- **AddPropertyDialog / EditPropertyDialog:** Submit-Button `disabled={isSubmitting}`, Beschriftung „Wird angelegt…“ / „Wird gespeichert…“, Zod-Validierung, native Form.
- **Mietvertragsverwaltung:** „Vertrag anlegen“-Button `disabled={addMutation.isPending || !form.tenant_name?.trim() || !form.property_id}`, „Wird angelegt…“.
- **DangerZoneSettings:** Label für Bestätigungsfeld, Loading-State „Wird gelöscht…“, Abbrechen während Request deaktiviert.
- **GlobalQuickTodo:** `aria-label` am Eingabefeld, Button `disabled={saving || !title.trim()}`.
- **DocumentTemplateGenerator:** Label „Objekt“ für Objekt-Select.
- **TeamManagement2:** Label mit `htmlFor`, Input mit `id` und `autoComplete="email"`.

## Optionale Verbesserungen

- **Enter zum Absenden:** In Dialogen ohne native Form: `onKeyDown={e => e.key === "Enter" && handleSubmit()}` auf Container oder primären Button-Fokus.
- **Autofocus:** Erstes sichtbares Feld bei Dialogöffnung fokussieren (`autoFocus` oder `useEffect` + `ref.focus()`).
- **Fehlermeldungen lesbar:** Kurze, handlungsorientierte Texte (z. B. „Bitte E-Mail eingeben“ statt „Invalid field“).

## Wo Formulare vorkommen

Siehe Übersicht aus dem Form-Check: Auth, Settings (Profil, Passwort, E-Mail, 2FA, Danger Zone), AddPropertyDialog, EditPropertyDialog, AddTenantDialog, AddContactDialog, AddLoanDialog, ContractManagement, Mietvertragsverwaltung, DealToPropertyConverter, DamageReport, TodoEditDialog, Deals, Loans, Contacts, SelbstauskunftGenerator, RentIncreaseWizard, DocumentTemplateGenerator, GlobalQuickTodo, TeamManagement2, DashboardPresets u. a.

Neue Formulare sollten von vornherein die Checkliste erfüllen.
