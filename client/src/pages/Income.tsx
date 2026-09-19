import { useNavigate } from "react-router-dom";
import { AisImport } from "../components/AisImport";
import { NumberField, Section, ToggleField } from "../components/FormControls";
import { useTaxReturn } from "../context/TaxReturnContext";

export function Income() {
  const { profile, updateProfile, save, saving } = useTaxReturn();
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Income Details</h1>

      <AisImport />

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

      <Section title="Business / Profession" description="Simplified net-profit entry (presumptive schemes not modeled).">
        <NumberField
          label="Net profit"
          value={profile.business.netProfit}
          onChange={(v) => updateProfile((p) => ({ ...p, business: { netProfit: v } }))}
        />
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
