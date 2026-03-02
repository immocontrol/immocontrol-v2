import { useMemo } from "react";

export const BUNDESLAENDER_GRUNDERWERBSTEUER: Record<string, number> = {
  "Baden-Württemberg": 5.0,
  "Bayern": 3.5,
  "Berlin": 6.0,
  "Brandenburg": 6.5,
  "Bremen": 5.0,
  "Hamburg": 5.5,
  "Hessen": 6.0,
  "Mecklenburg-Vorpommern": 6.0,
  "Niedersachsen": 5.0,
  "Nordrhein-Westfalen": 6.5,
  "Rheinland-Pfalz": 5.0,
  "Saarland": 6.5,
  "Sachsen": 5.5,
  "Sachsen-Anhalt": 5.0,
  "Schleswig-Holstein": 6.5,
  "Thüringen": 5.0,
};

export interface AnalysisInputState {
  kaufpreis: number;
  bundesland: string;
  maklerProvision: number;
  notarKosten: number;
  monatlicheMiete: number;
  bewirtschaftungskosten: number;
  eigenkapital: number;
  zinssatz: number;
  tilgung: number;
  afaDauer: number;
  persSteuersatz: number;
  quadratmeter: number;
}

export const DEFAULT_INPUTS: AnalysisInputState = {
  kaufpreis: 500000,
  bundesland: "Nordrhein-Westfalen",
  maklerProvision: 3.57,
  notarKosten: 1.5,
  monatlicheMiete: 3000,
  bewirtschaftungskosten: 600,
  eigenkapital: 100000,
  zinssatz: 3.5,
  tilgung: 2.0,
  afaDauer: 50,
  persSteuersatz: 42,
  quadratmeter: 100,
};

export interface AnalysisCalcResult {
  grunderwerbsteuer: number;
  makler: number;
  notar: number;
  kaufnebenkosten: number;
  gesamtkosten: number;
  darlehen: number;
  monatlicheRate: number;
  bruttoRendite: number;
  nettoRendite: number;
  monatsCashflow: number;
  jahresCashflow: number;
  cashOnCash: number;
  mietmultiplikator: number;
  afaJaehrlich: number;
  steuerlichesErgebnis: number;
  steuerEffekt: number;
  cashflowNachSteuer: number;
  preisProQm: number;
  mieteProQm: number;
}

/** Pure calculation function (testable without React) */
export function calculateAnalysis(inputs: AnalysisInputState): AnalysisCalcResult {
  const { kaufpreis, bundesland, maklerProvision, notarKosten, monatlicheMiete, bewirtschaftungskosten, eigenkapital, zinssatz, tilgung, afaDauer, persSteuersatz, quadratmeter } = inputs;

  const grunderwerbsteuer = kaufpreis * (BUNDESLAENDER_GRUNDERWERBSTEUER[bundesland] / 100);
  const makler = kaufpreis * (maklerProvision / 100);
  const notar = kaufpreis * (notarKosten / 100);
  const kaufnebenkosten = grunderwerbsteuer + makler + notar;
  const gesamtkosten = kaufpreis + kaufnebenkosten;

  const darlehen = gesamtkosten - eigenkapital;
  const monatlicheRate = (darlehen * (zinssatz + tilgung)) / 100 / 12;
  const monatlicheZinsen = (darlehen * zinssatz) / 100 / 12;

  const jahresmiete = monatlicheMiete * 12;
  const jahreskosten = bewirtschaftungskosten * 12;
  const bruttoRendite = kaufpreis > 0 ? (jahresmiete / kaufpreis) * 100 : 0;
  const nettoRendite = kaufpreis > 0 ? ((jahresmiete - jahreskosten) / kaufpreis) * 100 : 0;

  const monatsCashflow = monatlicheMiete - bewirtschaftungskosten - monatlicheRate;
  const jahresCashflow = monatsCashflow * 12;

  const cashOnCash = eigenkapital > 0 ? (jahresCashflow / eigenkapital) * 100 : 0;
  const mietmultiplikator = jahresmiete > 0 ? kaufpreis / jahresmiete : 0;

  const afaJaehrlich = kaufpreis * 0.8 / afaDauer;
  const abzugsfaehigeZinsen = monatlicheZinsen * 12;
  const steuerlichesErgebnis = jahresmiete - jahreskosten - abzugsfaehigeZinsen - afaJaehrlich;
  const steuerEffekt = steuerlichesErgebnis * (persSteuersatz / 100);
  const cashflowNachSteuer = jahresCashflow - steuerEffekt;

  const preisProQm = quadratmeter > 0 ? kaufpreis / quadratmeter : 0;
  const mieteProQm = quadratmeter > 0 ? monatlicheMiete / quadratmeter : 0;

  return {
    grunderwerbsteuer, makler, notar, kaufnebenkosten, gesamtkosten,
    darlehen, monatlicheRate, bruttoRendite, nettoRendite,
    monatsCashflow, jahresCashflow, cashOnCash, mietmultiplikator,
    afaJaehrlich, steuerlichesErgebnis, steuerEffekt, cashflowNachSteuer,
    preisProQm, mieteProQm,
  };
}

/** React hook wrapper — delegates to pure calculateAnalysis */
export function useAnalysisCalculations(inputs: AnalysisInputState): AnalysisCalcResult {
  return useMemo(() => calculateAnalysis(inputs), [inputs]);
}
