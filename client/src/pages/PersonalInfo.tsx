import { useNavigate } from "react-router-dom";
import { Section, SelectField, TextField } from "../components/FormControls";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { AgeBand, ResidentialStatus } from "../types";

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

      <Section
        title="Identity"
        description="Used only to prefill your filing worksheet export. Stored locally in this app's database, never sent anywhere except to the AI assistant's context if you use it."
      >
        <TextField
          label="Full name"
          value={profile.personalInfo.fullName}
          onChange={(v) => updateProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, fullName: v } }))}
        />
        <TextField
          label="PAN"
          value={profile.personalInfo.pan}
          onChange={(v) =>
            updateProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, pan: v.toUpperCase() } }))
          }
          placeholder="ABCDE1234F"
          hint="Optional — only needed if you plan to export a filing worksheet"
        />
        <TextField
          label="Date of birth"
          type="date"
          value={profile.personalInfo.dateOfBirth}
          onChange={(v) => updateProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, dateOfBirth: v } }))}
        />
        <SelectField<ResidentialStatus>
          label="Residential status"
          value={profile.personalInfo.residentialStatus}
          onChange={(residentialStatus) =>
            updateProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, residentialStatus } }))
          }
          options={[
            { value: "resident", label: "Resident" },
            { value: "notOrdinarilyResident", label: "Resident but Not Ordinarily Resident (RNOR)" },
            { value: "nonResident", label: "Non-Resident" },
          ]}
        />
      </Section>

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
