/**
 * Deal-Scoring: Priorisierung von Deals nach Kaufpreis, Miete, Rendite, Vollständigkeit.
 */
export interface DealScoreInput {
  purchase_price?: number | null;
  expected_rent?: number | null;
  expected_yield?: number | null;
  sqm?: number | null;
  units?: number | null;
  address?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  stage?: string;
}

export function calculateDealScore(deal: DealScoreInput): number {
  let score = 0;

  // Vollständigkeit (max 40)
  if (deal.purchase_price && deal.purchase_price > 0) score += 10;
  if (deal.expected_rent && deal.expected_rent > 0) score += 10;
  if (deal.address?.trim()) score += 5;
  if (deal.contact_phone || deal.contact_email) score += 5;
  if (deal.notes?.trim()) score += 5;
  if ((deal.sqm && deal.sqm > 0) || (deal.units && deal.units > 0)) score += 5;

  // Rendite (max 30) — Ziel > 4%
  if (deal.expected_yield && deal.expected_yield > 0) {
    if (deal.expected_yield >= 6) score += 30;
    else if (deal.expected_yield >= 5) score += 25;
    else if (deal.expected_yield >= 4) score += 20;
    else if (deal.expected_yield >= 3) score += 10;
    else score += 5;
  } else if (deal.purchase_price && deal.expected_rent && deal.purchase_price > 0) {
    const implied = (deal.expected_rent * 12 / deal.purchase_price) * 100;
    if (implied >= 6) score += 30;
    else if (implied >= 5) score += 25;
    else if (implied >= 4) score += 20;
    else if (implied >= 3) score += 10;
    else score += 5;
  }

  // Größe/Portfolio-Relevanz (max 20) — größere Objekte priorisieren
  if (deal.sqm && deal.sqm >= 500) score += 20;
  else if (deal.sqm && deal.sqm >= 200) score += 15;
  else if (deal.sqm && deal.sqm >= 100) score += 10;
  else if (deal.units && deal.units >= 4) score += 15;
  else if (deal.units && deal.units >= 2) score += 10;

  // Stage-Bonus (max 10)
  if (deal.stage === "besichtigung" || deal.stage === "verhandlung") score += 10;
  else if (deal.stage === "angebot") score += 5;

  return Math.min(score, 100);
}
