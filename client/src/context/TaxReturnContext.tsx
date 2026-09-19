import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { blankTaxProfile, type ComparisonResult, type TaxProfile } from "../types";

const DEFAULT_FY = "2024-25";

interface TaxReturnContextValue {
  financialYear: string;
  profile: TaxProfile;
  comparison: ComparisonResult | null;
  saving: boolean;
  loading: boolean;
  error: string | null;
  updateProfile: (updater: (draft: TaxProfile) => TaxProfile) => void;
  save: () => Promise<void>;
  recompute: () => Promise<void>;
}

const TaxReturnContext = createContext<TaxReturnContextValue | undefined>(undefined);

export function TaxReturnProvider({ children }: { children: ReactNode }) {
  const [financialYear] = useState(DEFAULT_FY);
  const [profile, setProfile] = useState<TaxProfile>(() => blankTaxProfile(DEFAULT_FY));
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getReturn(financialYear)
      .then((res) => {
        if (!cancelled) setProfile(res.profile);
      })
      .catch(() => {
        // No saved return yet for this FY — keep the blank profile.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [financialYear]);

  const updateProfile = useCallback((updater: (draft: TaxProfile) => TaxProfile) => {
    setProfile((prev) => updater(prev));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.saveReturn(financialYear, profile);
      setComparison(res.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [financialYear, profile]);

  const recompute = useCallback(async () => {
    setError(null);
    try {
      const res = await api.compute(financialYear, profile);
      setComparison(res.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute");
    }
  }, [financialYear, profile]);

  return (
    <TaxReturnContext.Provider
      value={{ financialYear, profile, comparison, saving, loading, error, updateProfile, save, recompute }}
    >
      {children}
    </TaxReturnContext.Provider>
  );
}

export function useTaxReturn(): TaxReturnContextValue {
  const ctx = useContext(TaxReturnContext);
  if (!ctx) throw new Error("useTaxReturn must be used within a TaxReturnProvider");
  return ctx;
}
