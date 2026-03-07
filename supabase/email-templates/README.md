# E-Mail-Vorlagen für Supabase Auth

Die Vorlagen in diesem Ordner können im **Supabase Dashboard** eingetragen werden, damit Auth-E-Mails (Konto bestätigen, Passwort zurücksetzen) professionell und auf Deutsch erscheinen.

**Supabase Dashboard** → dein Projekt → **Authentication** → **Email Templates**

---

## Konto bestätigen (Confirm signup)

1. Vorlage **„Confirm signup”** auswählen
2. **Subject** z. B.: `E-Mail bestätigen – ImmoControl`
3. **Message body**: Inhalt von `confirm-signup.html` kopieren und einfügen
4. **Save**

---

## Passwort zurücksetzen (Reset Password)

Die Vorlage `recovery.html` ist im gleichen professionellen Layout wie die Konto-Bestätigung (Confirm signup) gehalten.

1. Im **Supabase Dashboard** Vorlage **„Reset Password”** auswählen
2. **Subject** z. B.: `Passwort zurücksetzen – ImmoControl`
3. **Message body**: kompletten Inhalt von `recovery.html` kopieren und einfügen (Platzhalter `{{ .ConfirmationURL }}` und `{{ .Email }}` nicht entfernen)
4. **Save**

**Hinweis:** Der Link in der E-Mail führt zur App auf `/auth`. Dort sieht der Nutzer nur ein Formular „Neues Passwort setzen“ – kein Zugriff auf das Konto. Erst nach dem Setzen des neuen Passworts wird er abgemeldet und kann sich mit dem neuen Passwort anmelden.

Beide Vorlagen nutzen die Supabase-Variablen `{{ .ConfirmationURL }}` (Bestätigungs-/Reset-Link) und `{{ .Email }}` (E-Mail-Adresse des Nutzers).
