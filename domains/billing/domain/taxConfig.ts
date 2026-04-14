import { z } from "zod";

export const taxConfigSchema = z.object({
  defaultRate: z.number().min(0).max(1),
  jurisdictions: z.record(z.string(), z.number()),
});

export const taxRules = {
  defaultRate: 0.07,
  jurisdictions: {
    CA: 0.0725,
    NY: 0.08,
    NY_NEW_YORK_CITY: 0.08875,
    TX: 0.0625,
    WA: 0.065,
    IL: 0.0625,
    PA: 0.06,
    FL: 0.06,
  } as const,
};

export type TaxJurisdiction = keyof typeof taxRules.jurisdictions;

export function getTaxRate(jurisdiction?: string): number {
  if (!jurisdiction) return taxRules.defaultRate;
  const rate =
    taxRules.jurisdictions[jurisdiction as keyof typeof taxRules.jurisdictions];
  return rate ?? taxRules.defaultRate;
}

export function calculateTax(subtotal: number, jurisdiction?: string): number {
  const rate = getTaxRate(jurisdiction);
  return Math.round(subtotal * rate * 100) / 100;
}
