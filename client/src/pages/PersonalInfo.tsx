import { useNavigate } from "react-router-dom";
import { Section, SelectField } from "../components/FormControls";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { AgeBand } from "../types";

export function PersonalInfo() {
  const { profile, updateProfile, save, saving, financialYear } = useTaxReturn();
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Personal Info</h1>
      <p className="text-slate-500 text-sm mb-6">
        Assessment year {Number(financialYear.split("-")[0]) + 1}-{Number(financialYear.split("-")[1]) + 1} (FY{" "}
        {financialYear})
      </p>

      <Section title="Filing details" description="Your age band determines applicable tax slabs and 80D/80TTB limits.">
        <SelectField<AgeBand>
          label="Age band"
          value={profile.ageBand}
          onChange={(ageBand) => updateProfile((p) => ({ ...p, ageBand }))}
          options={[
            { value: "below60", label: "Below 60 years" },
            { value: "60to80", label: "60 to 80 years (senior citizen)" },
            { value: "above80", label: "Above 80 years (super senior citizen)" },
          ]}
        />
      </Section>

      <div className="flex justify-between">
        <div />
        <button
          onClick={async () => {
            await save();
            navigate("/income");
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
