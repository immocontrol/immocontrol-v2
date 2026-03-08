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

**Wichtig:** Die E-Mail sieht erst nach dem Eintragen im Dashboard anders aus. Supabase verwendet standardmäßig eine eigene Vorlage – solange du unsere nicht einfügst, bleibt das alte Aussehen.

**Schritt 1 – Zur richtigen Vorlage im Dashboard:**

1. Auf [supabase.com/dashboard](https://supabase.com/dashboard) einloggen.
2. Dein **Projekt** auswählen (z. B. das Projekt, in dem ImmoControl läuft).
3. In der linken Seitenleiste auf **Authentication** klicken (unter „Project“).
4. Im Untermenü von Authentication auf **Email Templates** klicken.
5. Oben siehst du eine Liste der Vorlagen (Confirm signup, Invite user, Magic Link, **Reset Password**, …). Auf **Reset Password** klicken – die Seite zeigt dann die aktuelle Vorlage für die Passwort-zurücksetzen-E-Mail (Betreff und Nachrichtentext).

**Schritt 2 – Betreff und Inhalt eintragen:**

6. **Subject** z. B.: `Passwort zurücksetzen – ImmoControl`
7. **Message body**: **kompletten** Inhalt der Datei `recovery.html` aus diesem Ordner kopieren (von `<!DOCTYPE html>` bis `</html>`) und ins Feld **Message body** einfügen. Platzhalter `{{ .ConfirmationURL }}` und `{{ .Email }}` nicht entfernen.
8. Falls es eine Option **„Customize email template”** oder **„Use custom template”** gibt: aktivieren, damit HTML angenommen wird.
9. **Save** klicken. Danach werden neue Reset-E-Mails mit dem neuen Layout versendet.

**Hinweis:** Der Link in der E-Mail führt zur App auf `/auth`. Dort sieht der Nutzer nur ein Formular „Neues Passwort setzen“ – kein Zugriff auf das Konto. Erst nach dem Setzen des neuen Passworts wird er abgemeldet und kann sich mit dem neuen Passwort anmelden.

Beide Vorlagen nutzen die Supabase-Variablen `{{ .ConfirmationURL }}` (Bestätigungs-/Reset-Link) und `{{ .Email }}` (E-Mail-Adresse des Nutzers).
