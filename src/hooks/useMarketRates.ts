/**
 * #1: Live-Zinsmonitor — fetches EURIBOR 3M from ECB and German mortgage rates from Bundesbank
 * Both APIs are free, no authentication required.
 */
import { useQuery } from "@tanstack/react-query";

export interface MarketRateData {
  euribor3m: { date: string; rate: number }[];
  mortgageRate: { date: string; rate: number }[];
  latestEuribor: number | null;
  latestMortgage: number | null;
  lastUpdated: string | null;
}

/* 20-year history (240 monthly observations) for long-term trend charts */
const ECB_URL = "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?lastNObservations=240&format=csvdata";
const BUNDESBANK_URL = "https://api.statistiken.bundesbank.de/rest/data/BBIM1/M.DE.B.A2C.I.R.A.2250.EUR.N?lastNObservations=240&format=csv";

function parseECBCsv(csv: string): { date: string; rate: number }[] {
  const lines = csv.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  // Header is first line, data starts at line 2
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    // TIME_PERIOD is col 8, OBS_VALUE is col 9
    const date = cols[8]?.trim() || "";
    const rate = parseFloat(cols[9]?.trim() || "0");
    if (!date || isNaN(rate)) return null;
    return { date, rate };
  }).filter((x): x is { date: string; rate: number } => x !== null);
}

function parseBundesbankCsv(csv: string): { date: string; rate: number }[] {
  const lines = csv.split("\n").filter(l => l.trim());
  // Bundesbank CSV has metadata lines, then data rows like "2025-10;3,60;"
  const dataLines = lines.filter(l => /^\d{4}-\d{2};/.test(l));
  return dataLines.map(line => {
    const parts = line.split(";");
    const date = parts[0]?.trim() || "";
    const rateStr = parts[1]?.trim().replace(",", ".") || "0";
    const rate = parseFloat(rateStr);
    if (!date || isNaN(rate)) return null;
    return { date, rate };
  }).filter((x): x is { date: string; rate: number } => x !== null);
}

async function fetchMarketRates(): Promise<MarketRateData> {
  const [ecbRes, bbRes] = await Promise.allSettled([
    fetch(ECB_URL).then(r => r.text()),
    fetch(BUNDESBANK_URL).then(r => r.text()),
  ]);

  const euribor3m = ecbRes.status === "fulfilled" ? parseECBCsv(ecbRes.value) : [];
  const mortgageRate = bbRes.status === "fulfilled" ? parseBundesbankCsv(bbRes.value) : [];

  return {
    euribor3m,
    mortgageRate,
    latestEuribor: euribor3m.length > 0 ? euribor3m[euribor3m.length - 1].rate : null,
    latestMortgage: mortgageRate.length > 0 ? mortgageRate[mortgageRate.length - 1].rate : null,
    lastUpdated: new Date().toISOString(),
  };
}

export function useMarketRates() {
  return useQuery({
    queryKey: ["market_rates"],
    queryFn: fetchMarketRates,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/** ECB HICP inflation rate (Eurozone) */
const ECB_HICP_URL = "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.ANR?lastNObservations=24&format=csvdata";

function parseHICPCsv(csv: string): { date: string; rate: number }[] {
  const lines = csv.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  // Find TIME_PERIOD and OBS_VALUE column indices from header
  const header = lines[0].split(",");
  const timeIdx = header.findIndex(h => h.trim() === "TIME_PERIOD");
  const obsIdx = header.findIndex(h => h.trim() === "OBS_VALUE");
  if (timeIdx < 0 || obsIdx < 0) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const date = cols[timeIdx]?.trim() || "";
    const rate = parseFloat(cols[obsIdx]?.trim() || "0");
    if (!date || isNaN(rate)) return null;
    return { date, rate };
  }).filter((x): x is { date: string; rate: number } => x !== null);
}

export function useInflationRate() {
  return useQuery({
    queryKey: ["inflation_rate_hicp"],
    queryFn: async () => {
      const res = await fetch(ECB_HICP_URL);
      const csv = await res.text();
      const data = parseHICPCsv(csv);
      return {
        data,
        latest: data.length > 0 ? data[data.length - 1].rate : null,
        latestDate: data.length > 0 ? data[data.length - 1].date : null,
      };
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/** Bundesbank House Price Index */
const BUNDESBANK_HPI_URL = "https://api.statistiken.bundesbank.de/rest/data/BBEX3/Q.DE.N.H.HPP.IX.Q?lastNObservations=20&format=csv";

export function useHousePriceIndex() {
  return useQuery({
    queryKey: ["house_price_index"],
    queryFn: async () => {
      const res = await fetch(BUNDESBANK_HPI_URL);
      const csv = await res.text();
      const data = parseBundesbankCsv(csv);
      return {
        data,
        latest: data.length > 0 ? data[data.length - 1].rate : null,
        latestDate: data.length > 0 ? data[data.length - 1].date : null,
      };
    },
    staleTime: 1000 * 60 * 60 * 4, // 4 hours
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
