import { useNavigate } from "react-router-dom";
import { AisImport } from "../components/AisImport";
import { Form16Import } from "../components/Form16Import";
import { NumberField, Section, SelectField, ToggleField } from "../components/FormControls";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { PresumptiveScheme } from "../types";
import { computePresumptiveDetails } from "../utils/presumptive";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function Income() {
  const { profile, updateProfile, save, saving } = useTaxReturn();
  const navigate = useNavigate();
  const presumptive = computePresumptiveDetails(profile.business);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Income Details</h1>

      <AisImport />
      <Form16Import />

      <Section title="Salary" description="Figures as per your Form 16 / payslips for the financial year.">
        <NumberField
          label="Basic + DA (annual)"
          value={profile.salary.basicPlusDA}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, basicPlusDA: v } }))}
        />
        <NumberField
          label="Other allowances (annual)"
          value={profile.salary.otherAllowances}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, otherAllowances: v } }))}
        />
        <NumberField
          label="HRA received (annual)"
          value={profile.salary.hraReceived}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, hraReceived: v } }))}
        />
        <NumberField
          label="Rent paid (annual)"
          value={profile.salary.rentPaid}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, rentPaid: v } }))}
          hint="Only relevant for HRA exemption under the old regime"
        />
        <ToggleField
          label="I live in a metro city (Delhi, Mumbai, Kolkata, Chennai)"
          checked={profile.salary.isMetro}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, isMetro: v } }))}
        />
        <NumberField
          label="Employer's NPS contribution (annual)"
          value={profile.salary.employerNpsContribution}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, employerNpsContribution: v } }))}
          hint="Eligible for deduction under Section 80CCD(2) in both regimes, within limits"
        />
        <NumberField
          label="Professional tax paid (annual)"
          value={profile.salary.professionalTax}
          onChange={(v) => updateProfile((p) => ({ ...p, salary: { ...p.salary, professionalTax: v } }))}
          hint="Section 16(iii) — deductible only under the old regime"
        />
      </Section>

      <Section title="House Property" description="Rental income or home loan interest on a self-occupied home.">
        <ToggleField
          label="This property is self-occupied"
          checked={profile.houseProperty.isSelfOccupied}
          onChange={(v) => updateProfile((p) => ({ ...p, houseProperty: { ...p.houseProperty, isSelfOccupied: v } }))}
        />
        {!profile.houseProperty.isSelfOccupied && (
          <>
            <NumberField
              label="Annual rent received"
              value={profile.houseProperty.annualRentReceived}
              onChange={(v) =>
                updateProfile((p) => ({ ...p, houseProperty: { ...p.houseProperty, annualRentReceived: v } }))
              }
            />
            <NumberField
              label="Municipal taxes paid"
              value={profile.houseProperty.municipalTaxesPaid}
              onChange={(v) =>
                updateProfile((p) => ({ ...p, houseProperty: { ...p.houseProperty, municipalTaxesPaid: v } }))
              }
            />
          </>
        )}
        <NumberField
          label="Home loan interest paid (Sec 24b)"
          value={profile.houseProperty.homeLoanInterest}
          onChange={(v) => updateProfile((p) => ({ ...p, houseProperty: { ...p.houseProperty, homeLoanInterest: v } }))}
          hint={profile.houseProperty.isSelfOccupied ? "Capped at ₹2,00,000 and only allowed in the old regime" : "No cap for let-out property"}
        />
      </Section>

      <Section title="Capital Gains" description="Gains from listed equity shares / equity mutual funds and other assets (FY24-25 rates).">
        <NumberField
          label="STCG on listed equity (Sec 111A)"
          value={profile.capitalGains.stcgEquity}
          onChange={(v) => updateProfile((p) => ({ ...p, capitalGains: { ...p.capitalGains, stcgEquity: v } }))}
          hint="Taxed at a flat 20%"
        />
        <NumberField
          label="LTCG on listed equity (Sec 112A)"
          value={profile.capitalGains.ltcgEquity}
          onChange={(v) => updateProfile((p) => ({ ...p, capitalGains: { ...p.capitalGains, ltcgEquity: v } }))}
          hint="First ₹1,25,000 exempt; balance taxed at 12.5%"
        />
        <NumberField
          label="Other short-term capital gains"
          value={profile.capitalGains.stcgOther}
          onChange={(v) => updateProfile((p) => ({ ...p, capitalGains: { ...p.capitalGains, stcgOther: v } }))}
          hint="Taxed at your slab rate"
        />
        <NumberField
          label="Other long-term capital gains"
          value={profile.capitalGains.ltcgOther}
          onChange={(v) => updateProfile((p) => ({ ...p, capitalGains: { ...p.capitalGains, ltcgOther: v } }))}
          hint="Simplified flat 12.5% (indexation not modeled)"
        />
      </Section>

      <Section title="Other Sources" description="Interest, dividends, and other miscellaneous income.">
        <NumberField
          label="Savings account interest"
          value={profile.otherSources.savingsInterest}
          onChange={(v) => updateProfile((p) => ({ ...p, otherSources: { ...p.otherSources, savingsInterest: v } }))}
        />
        <NumberField
          label="Fixed deposit interest"
          value={profile.otherSources.fdInterest}
          onChange={(v) => updateProfile((p) => ({ ...p, otherSources: { ...p.otherSources, fdInterest: v } }))}
        />
        <NumberField
          label="Dividend income"
          value={profile.otherSources.dividendIncome}
          onChange={(v) => updateProfile((p) => ({ ...p, otherSources: { ...p.otherSources, dividendIncome: v } }))}
        />
        <NumberField
          label="Other income"
          value={profile.otherSources.otherIncome}
          onChange={(v) => updateProfile((p) => ({ ...p, otherSources: { ...p.otherSources, otherIncome: v } }))}
        />
      </Section>

      <Section
        title="Business / Profession"
        description="For regular books of account, just enter net profit. To opt for presumptive taxation under Section 44AD (business) or 44ADA (profession) — which uses ITR-4 instead of ITR-3 — fill in the turnover details below."
      >
        <ToggleField
          label="Opt for presumptive taxation (Sec 44AD / 44ADA)"
          checked={profile.business.presumptiveScheme !== "none"}
          onChange={(checked) =>
            updateProfile((p) => ({
              ...p,
              business: { ...p.business, presumptiveScheme: checked ? "44AD" : "none" },
            }))
          }
        />
        {profile.business.presumptiveScheme !== "none" && (
          <>
            <SelectField<PresumptiveScheme>
              label="Scheme"
              value={profile.business.presumptiveScheme}
              onChange={(scheme) => updateProfile((p) => ({ ...p, business: { ...p.business, presumptiveScheme: scheme } }))}
              options={[
                { value: "44AD", label: "Section 44AD — business" },
                { value: "44ADA", label: "Section 44ADA — profession" },
              ]}
            />
            <NumberField
              label="Annual turnover / gross receipts"
              value={profile.business.turnoverOrGrossReceipts}
              onChange={(v) => updateProfile((p) => ({ ...p, business: { ...p.business, turnoverOrGrossReceipts: v } }))}
            />
            <ToggleField
              label="At least 95% of receipts were via banking/digital channels"
              checked={profile.business.digitalReceiptsMostly}
              onChange={(v) => updateProfile((p) => ({ ...p, business: { ...p.business, digitalReceiptsMostly: v } }))}
              hint="Raises the turnover limit and lowers the minimum profit rate for Section 44AD"
            />
          </>
        )}
        <NumberField
          label="Net profit (declared)"
          value={profile.business.netProfit}
          onChange={(v) => updateProfile((p) => ({ ...p, business: { ...p.business, netProfit: v } }))}
        />
        {presumptive && (
          <div className="sm:col-span-2 text-sm rounded-md p-3 bg-slate-50 dark:bg-slate-900">
            <p>
              Minimum profit to declare under Section {presumptive.scheme} ({Math.round(presumptive.rate * 100)}% of
              turnover/receipts): <strong>{formatINR(presumptive.minimumPresumptiveProfit)}</strong>
            </p>
            {!presumptive.withinTurnoverLimit && (
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                Turnover/receipts exceed the {formatINR(presumptive.turnoverLimit)} limit for Section{" "}
                {presumptive.scheme} — presumptive taxation isn't available; ITR-3 with regular books of account
                will be required instead.
              </p>
            )}
            {presumptive.withinTurnoverLimit && !presumptive.meetsMinimumProfit && (
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                Declared profit is below the minimum — presumptive taxation requires declaring at least this
                amount, otherwise ITR-3 with regular books of account applies instead.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="Taxes already paid" description="So we can tell you the balance payable or refund due.">
        <NumberField
          label="TDS already deducted"
          value={profile.tdsAlreadyPaid}
          onChange={(v) => updateProfile((p) => ({ ...p, tdsAlreadyPaid: v }))}
        />
        <NumberField
          label="Advance tax paid"
          value={profile.advanceTaxPaid}
          onChange={(v) => updateProfile((p) => ({ ...p, advanceTaxPaid: v }))}
        />
      </Section>

      <div className="flex justify-between">
        <button
          onClick={() => navigate("/personal-info")}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={async () => {
            await save();
            navigate("/deductions");
          }}
          disabled={saving}
          className="rounded-md bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & continue"}
        </button>
      </div>
    </div>
  );
}
