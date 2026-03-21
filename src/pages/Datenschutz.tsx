import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { PageHeader, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const Datenschutz = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = "Datenschutz – ImmoControl";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" role="main" aria-label="Datenschutzerklärung">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to={ROUTES.AUTH}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded-md mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Anmeldung
        </Link>

        <PageHeader className="mb-8">
          <PageHeaderMain>
            <PageHeaderTitle>Datenschutzerklärung</PageHeaderTitle>
            <PageHeaderDescription className="mb-0">
              Stand: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
            </PageHeaderDescription>
          </PageHeaderMain>
        </PageHeader>

        <div className="space-y-8 text-wrap-safe hyphens-auto">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Verantwortlicher</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Verantwortlich für die Datenverarbeitung im Sinne der DSGVO:
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              [Name / Firma]
              [Straße und Hausnummer]
              [PLZ und Ort]
              [Land]
              E-Mail: [kontakt@example.com]
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Ausführliche Kontaktdaten und Anbieterangaben findest du im{" "}
              <Link to={ROUTES.IMPRESSUM} className="text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded">Impressum</Link>.
              Bitte die Platzhalter oben und im Impressum durch deine Angaben ersetzen (src/pages/Datenschutz.tsx, src/pages/Impressum.tsx).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Erhobene Daten</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Beim Besuch und bei der Nutzung der Anwendung können u. a. folgende Daten verarbeitet werden:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Angaben zur Registrierung und Anmeldung (z. B. E-Mail, Passwort-Hash)</li>
              <li>Nutzungsdaten (z. B. Gerät, Browser, Zugriffszeiten)</li>
              <li>Inhalte, die du in der Anwendung anlegst (z. B. Objekte, Kontakte, Dokumente)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Zweck der Verarbeitung</h2>
            <p className="text-sm text-muted-foreground">
              Die Verarbeitung dient dem Betrieb der Anwendung, der Bereitstellung der von dir genutzten Funktionen,
              der Sicherheit und Stabilität des Systems sowie der Erfüllung gesetzlicher Pflichten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Rechtsgrundlage</h2>
            <p className="text-sm text-muted-foreground">
              Die Verarbeitung erfolgt auf Grundlage deiner Einwilligung, zur Vertragserfüllung bzw. zur Durchführung
              vorvertraglicher Maßnahmen sowie, soweit erforderlich, zur Wahrung berechtigter Interessen des
              Verantwortlichen oder zur Erfüllung rechtlicher Verpflichtungen (Art. 6 Abs. 1 DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Speicherdauer</h2>
            <p className="text-sm text-muted-foreground">
              Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke nötig ist oder
              gesetzliche Aufbewahrungsfristen bestehen. Nach Löschung deines Kontos werden die zugehörigen Daten
              in einem mit dem Recht vereinbaren Rahmen gelöscht oder anonymisiert.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Deine Rechte</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Dir stehen u. a. folgende Rechte zu:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Auskunft (Art. 15 DSGVO)</li>
              <li>Berichtigung (Art. 16 DSGVO)</li>
              <li>Löschung (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch (Art. 21 DSGVO)</li>
              <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Hosting und Drittanbieter</h2>
            <p className="text-sm text-muted-foreground">
              Die Anwendung kann Dienste Dritter nutzen (z. B. Hosting, Authentifizierung, Datenbanken).
              Soweit personenbezogene Daten an Drittanbieter übermittelt werden, erfolgt dies auf Grundlage
              von Verträgen zur Auftragsverarbeitung bzw. anerkannten Garantien im Sinne des Datenschutzrechts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Änderungen</h2>
            <p className="text-sm text-muted-foreground">
              Diese Datenschutzerklärung kann bei Bedarf angepasst werden. Die jeweils aktuelle Fassung ist auf
              dieser Seite abrufbar. Bei wesentlichen Änderungen werden angemeldete Nutzerinnen und Nutzer
              informiert, soweit dies vorgesehen ist.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 items-center">
          <Link to={ROUTES.IMPRESSUM} className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded">Impressum</Link>
          <Link to={ROUTES.NUTZUNGSBEDINGUNGEN} className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded">Nutzungsbedingungen</Link>
          <Link
            to={ROUTES.AUTH}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Datenschutz;
