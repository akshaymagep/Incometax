import type { AgeBand, ComparisonResult, TaxProfile } from "../types";

/**
 * Approximate, client-side planning helpers. These intentionally duplicate a *small* slice of the
 * old-regime slab table (for a quick marginal-rate estimate) rather than the full engine — for
 * anything that must be authoritative (the actual regime comparison, ITR-form pick), we call the
 * real `/compute` endpoint instead of re-implementing the tax engine here. Treat the numbers on
 * this page as directional planning estimates, not the return itself.
 */

interface SlabBracket {
  upto: number;
  rate: number;
}

function oldRegimeSlabs(ageBand: AgeBand): SlabBracket[] {
  if (ageBand === "above80") {
    return [
      { upto: 500000, rate: 0 },
      { upto: 1000000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ];
  }
  if (ageBand === "60to80") {
    return [
      { upto: 300000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ];
  }
  return [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ];
}

export function marginalRateOld(taxableIncome: number, ageBand: AgeBand): number {
  const brackets = oldRegimeSlabs(ageBand);
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.upto) return bracket.rate;
  }
  return brackets[brackets.length - 1].rate;
}

export interface HeadroomItem {
  key: string;
  label: string;
  used: number;
  cap: number;
  remaining: number;
  estTaxSaved: number;
}

export function computeDeductionHeadroom(profile: TaxProfile, comparison: ComparisonResult): HeadroomItem[] {
  const rate = marginalRateOld(comparison.old.taxableIncomeSlabPortion, profile.ageBand) * 1.04; // include 4% cess
  const d = profile.deductions;
  const selfCap = profile.ageBand === "below60" ? 25000 : 50000;
  const parentsCap = d.parentsAreSenior ? 50000 : 25000;

  const items: [string, string, number, number][] = [
    ["80C", "Section 80C (PPF, ELSS, EPF, life insurance…)", d.section80C, 150000],
    ["80CCD1B", "Section 80CCD(1B) additional NPS", d.section80CCD1B, 50000],
    ["80D_self", "Section 80D — self & family health insurance", d.section80D_self, selfCap],
    ["80D_parents", "Section 80D — parents' health insurance", d.section80D_parents, parentsCap],
  ];

  return items
    .map(([key, label, used, cap]) => {
      const remaining = Math.max(0, cap - used);
      return { key, label, used, cap, remaining, estTaxSaved: Math.round(remaining * rate) };
    })
    .filter((item) => item.remaining > 0);
}

export function buildMaxedDeductionsProfile(profile: TaxProfile): TaxProfile {
  const selfCap = profile.ageBand === "below60" ? 25000 : 50000;
  const parentsCap = profile.deductions.parentsAreSenior ? 50000 : 25000;
  return {
    ...profile,
    deductions: {
      ...profile.deductions,
      section80C: 150000,
      section80CCD1B: 50000,
      section80D_self: selfCap,
      section80D_parents: parentsCap,
    },
  };
}

export function buildProjectedProfile(
  profile: TaxProfile,
  opts: { salaryGrowthPct: number; extra80C: number; extra80CCD1B: number }
): TaxProfile {
  const growthFactor = 1 + opts.salaryGrowthPct / 100;
  return {
    ...profile,
    salary: {
      ...profile.salary,
      basicPlusDA: Math.round(profile.salary.basicPlusDA * growthFactor),
      otherAllowances: Math.round(profile.salary.otherAllowances * growthFactor),
      hraReceived: Math.round(profile.salary.hraReceived * growthFactor),
    },
    deductions: {
      ...profile.deductions,
      section80C: Math.min(150000, profile.deductions.section80C + opts.extra80C),
      section80CCD1B: Math.min(50000, profile.deductions.section80CCD1B + opts.extra80CCD1B),
    },
  };
}
