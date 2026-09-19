import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTaxReturn } from "../context/TaxReturnContext";

const steps = [
  { to: "/personal-info", title: "Personal Info", description: "Age band and filing basics." },
  { to: "/income", title: "Income", description: "Salary, house property, capital gains, other income." },
  { to: "/deductions", title: "Deductions", description: "80C, 80D, and other tax-saving investments." },
  { to: "/summary", title: "Summary", description: "Compare old vs new regime and see your tax liability." },
  { to: "/planning", title: "Planning", description: "Unused deduction room and a projection for next year." },
];

export function Dashboard() {
  const { user } = useAuth();
  const { comparison } = useTaxReturn();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
      <p className="text-slate-500 text-sm mb-8">
        Let's get your Financial Year 2024-25 (AY 2025-26) income tax return in order. Fill in your details
        step by step, then compare the old and new tax regimes.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {steps.map((step) => (
          <Link
            key={step.to}
            to={step.to}
            className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-brand-500 hover:shadow-sm transition"
          >
            <h2 className="font-semibold mb-1">{step.title}</h2>
            <p className="text-sm text-slate-500">{step.description}</p>
          </Link>
        ))}
      </div>

      {comparison && (
        <div className="bg-brand-50 dark:bg-slate-800 border border-brand-100 dark:border-slate-700 rounded-xl p-5 text-sm">
          Your last computed recommendation: <strong className="capitalize">{comparison.recommended} regime</strong>{" "}
          — see the <Link to="/summary" className="text-brand-600 font-medium">full summary</Link>.
        </div>
      )}

      <div className="mt-8 text-xs text-slate-400">
        This is a planning tool to help you understand your likely tax liability and prepare the numbers you'll
        need. It does not submit anything to the Income Tax Department — always file through the official portal
        (incometax.gov.in) or with a qualified chartered accountant.
      </div>
    </div>
  );
}
