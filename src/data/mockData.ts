export interface Property {
  id: string;
  name: string;
  location: string;
  address: string;
  type: string;
  units: number;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  monthlyCashflow: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  yearBuilt: number;
  ownership: "privat" | "egbr";
}
