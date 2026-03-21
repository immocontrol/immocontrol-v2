import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { PageHeader, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";

const Impressum = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = "Impressum – ImmoControl";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" role="main" aria-label="Impressum">
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
            <PageHeaderTitle>Impressum</PageHeaderTitle>
            <PageHeaderDescription className="mb-0">Angaben gemäß § 5 TMG</PageHeaderDescription>
          </PageHeaderMain>
        </PageHeader>

        <div className="space-y-6 text-wrap-safe hyphens-auto">
          <section>
            <h2 className="text-lg font-semibold mb-2">Anbieter / Verantwortlich für die App</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              [Name / Firma]
              [Straße und Hausnummer]
              [PLZ und Ort]
              [Land]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Kontakt</h2>
            <p className="text-sm text-muted-foreground">
              E-Mail: [kontakt@example.com]
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Bitte die Platzhalter in dieser Datei durch deine Angaben ersetzen (src/pages/Impressum.tsx).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Umsatzsteuer-ID</h2>
            <p className="text-sm text-muted-foreground">
              [Falls vorhanden: Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Verantwortlich für den Inhalt</h2>
            <p className="text-sm text-muted-foreground">
              [Name und Anschrift, sofern abweichend vom Anbieter]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Streitschlichtung</h2>
            <p className="text-sm text-muted-foreground">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4">
          <Link
            to={ROUTES.DATENSCHUTZ}
            className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Datenschutz
          </Link>
          <Link
            to={ROUTES.NUTZUNGSBEDINGUNGEN}
            className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Nutzungsbedingungen
          </Link>
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

export default Impressum;
