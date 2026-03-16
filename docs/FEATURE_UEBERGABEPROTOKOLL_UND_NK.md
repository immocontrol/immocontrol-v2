# Feature-Plan: Übergabeprotokoll (Mieter bestätigt) & Nebenkostenabrechnung

Ziel: (1) Übergabeprotokoll in der App erstellen, Mieter erhält es und kann bestätigen. (2) Nebenkostenabrechnung für MFH und Wohnung nach aktuellem Recht (BetrKV etc.) erstellen und dem Mieter zukommen lassen.

---

## 1. Übergabeprotokoll – Mieter erhält und bestätigt

### Ist-Zustand

- **`HandoverProtocol.tsx`** existiert: Räume, Zustand (1–5), Zählerstände (Strom, Gas, Wasser, Heizung), Schlüssel, PDF-Export mit Unterschriftsfeldern (Vermieter / Mieter).
- Kein Speichern in der DB, kein Versand an den Mieter, keine Bestätigung durch den Mieter in der App.

### Soll

- Vermieter erstellt das Protokoll in der App (wie bisher), wählt **Objekt + Mieter** (aus bestehenden Mietverhältnissen).
- Protokoll wird **gespeichert** (neue Tabelle oder Erweiterung), **PDF erzeugt** und optional **per E-Mail/Link an den Mieter** gesendet.
- Mieter erhält einen **Link** (z. B. ins Mieterportal oder magic link ohne Login).
- Mieter sieht das **Protokoll (Lesefassung/PDF)** und kann es **bestätigen**:
  - Option A: Digitale Unterschrift (Signature Pad) + „Bestätigt am [Datum]“.
  - Option B: Klick „Ich bestätige den Inhalt“ + Datum/Uhrzeit (rechtsverbindlich dokumentiert).
- Bestätigung wird **gespeichert** und im Vermieter-Bereich angezeigt („Mieter hat am … bestätigt“); PDF kann mit Bestätigungsvermerk erneut exportiert werden.

### Technik (Vorschlag)

- **DB:** z. B. Tabelle `handover_protocols` (id, property_id, tenant_id, type [einzug/auszug], protocol_data JSONB, pdf_storage_path, created_at, created_by, tenant_confirmed_at, tenant_signature_data optional).
- **Vermieter:** Erweiterung von `HandoverProtocol.tsx`: Speichern-Button, Mieter zuweisen, „Link an Mieter senden“ (E-Mail mit Link zu `/mieter/uebergabe/:token` oder Mieterportal-Tab).
- **Mieter:** Neue Route/View (Mieterportal oder öffentlicher Token-Link): Protokoll anzeigen, Button „Bestätigen“ + optional Signature Pad; nach Bestätigung UPDATE `tenant_confirmed_at` (+ optional Signatur), ggf. PDF mit Bestätigung neu generieren und in Storage legen.
- **Recht:** Hinweis „Mit der Bestätigung erkennen Sie den dokumentierten Zustand an“; Speicherung der IP/Zeitstempel optional für Nachweis.

---

## 2. Nebenkostenabrechnung – MFH & Wohnung, nach aktuellem Recht

### Rechtlicher Rahmen (Deutschland, Stand Planung)

- **Betriebskostenverordnung (BetrKV)** – Anlage 3: umlagefähige Kosten und zulässige Verteilerschlüssel (Fläche, Verbrauch, Personen, Einheiten etc.).
- **§ 259 BGB** – Abrechnungsfrist (12 Monate nach Ende des Abrechnungszeitraums), Mitteilungspflicht.
- **HeizkostenV** – Bei verbrauchsabhängiger Heizkostenabrechnung: verbrauchsabhängig mind. 50–70 %, Rest nach Fläche/anderen Schlüsseln; Abrechnung pro Wohnung mit Verbrauchswerten.
- **MFH vs. Einzelwohnung:** MFH = Umlage auf alle Parteien (WEG oder Vermieter mit mehreren Mieteinheiten); Einzelwohnung = Abrechnung nur gegenüber einem Mieter (gleiche Positionen, aber keine Aufteilung auf mehrere Parteien).

### Ist-Zustand

- **`IntelligentNKAbrechnung.tsx`** – BetrKV-Positionen, Umlageschlüssel (Fläche, Personen, Einheiten, Verbrauch), PDF-Ansatz.
- **`Nebenkosten.tsx`** – `utility_billings`, `utility_billing_items`, Verknüpfung Objekt/Mieter, Abrechnungszeitraum, Verteilung (z. B. Fläche).
- **`AutoNebenkosten`**, **`NebenkostenGenerator`** – weitere Bausteine.

### Soll

- **Ein Modul „Nebenkostenabrechnung“**, das:
  - **MFH:** Alle Wohneinheiten/Parteien des Objekts lädt, Gesamtkosten pro Position erfasst, Verteilung nach **BetrKV** (Fläche, Verbrauch, Personen, Einheiten je nach Position), Abrechnung pro Mieter/Wohnung mit anteiligen Beträgen und Nachweis (Vorauszahlungen vs. Ist).
  - **Einzelwohnung:** Dieselben Positionen, eine Partei – keine Umlage auf mehrere, aber gleiche rechtliche Anforderungen (Frist, Aufschlüsselung, HeizkostenV wenn zutreffend).
- **Rechtssichere Formulierungen** im PDF (Abrechnungszeitraum, Hinweis auf Frist § 259 BGB, Auflistung umlagefähiger Kosten gem. BetrKV, Verteilerschlüssel genannt).
- **Heizkosten/Warmwasser:** Wenn verbrauchsabhängig – Erfassung Verbrauch pro Einheit, Aufteilung nach HeizkostenV (z. B. 70 % Verbrauch, 30 % Fläche); wenn nicht verbrauchsabhängig – nur Fläche/Einheiten.
- **PDF pro Mieter** erzeugen (eine Abrechnung pro Mieteinheit), Versand/Link wie beim Übergabeprotokoll (E-Mail, Mieterportal, Download).
- **Prüfliste „nach aktuellem Recht“:** Abrechnungsfrist 12 Monate, nur umlagefähige Kosten (BetrKV), korrekter Schlüssel pro Kostenart, bei Heizung HeizkostenV beachten; optional Hinweis auf Einsichtnahme/Anfragen.

### Technik (Vorschlag)

- Bestehende Tabellen **`utility_billings`** / **`utility_billing_items`** erweitern oder klar nutzen: Objekt, Abrechnungsjahr, Zeitraum, pro Position: Kostenart (BetrKV-konform), Gesamtbetrag, Verteilerschlüssel (flaeche/verbrauch/personen/einheiten), ggf. Verbrauchswerte pro Einheit.
- **Verteilung:** Pro Objekt Flächen/Wohnungen aus Properties/Units; bei Verbrauch Erfassung pro Mieter/Einheit (z. B. Heizkosten-Verbrauch).
- **PDF:** Einheitliches Layout mit Abschnitten „Grunddaten“, „Kostenaufstellung“, „Ihre Vorauszahlungen“, „Nachzahlung/Guthaben“, „Rechtliche Hinweise“; Textbausteine für BetrKV/§ 259 BGB/HeizkostenV.
- **MFH vs. Wohnung:** Logik „Anzahl Einheiten > 1“ → MFH-Umlage; „= 1“ → Einzelabrechnung; gleiche Kostenarten, unterschiedliche Verteillogik.

---

## Priorisierung Umsetzung

1. **Übergabeprotokoll:** DB-Schema + Speichern → Link/Token für Mieter → Mieter-View mit Bestätigung (+ optional Signatur) → Vermieter sieht Bestätigungsstatus.
2. **NK-Abrechnung:** BetrKV/HeizkostenV in Abrechnungslogik verankern → MFH vs. Einzelwohnung → PDF mit rechtlichen Texten → pro Mieter exportierbar/versendbar.

Die früheren Vorschläge (Cashflow-Szenarien, Deal-Pipeline, Kalender-Export etc.) sind in **`BACKLOG_FEATURES_SPAETER.md`** festgehalten.
