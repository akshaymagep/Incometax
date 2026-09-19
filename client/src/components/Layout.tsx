import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChatWidget } from "./ChatWidget";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/personal-info", label: "Personal Info" },
  { to: "/income", label: "Income" },
  { to: "/deductions", label: "Deductions" },
  { to: "/summary", label: "Summary" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-brand-600 text-lg">IncomeTax AI</div>
          <nav className="hidden sm:flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-slate-700 dark:text-brand-400"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:inline">{user?.email}</span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm font-medium text-slate-600 hover:text-red-600 dark:text-slate-300"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="sm:hidden flex overflow-x-auto gap-1 px-4 pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
      <ChatWidget />
      <footer className="text-center text-xs text-slate-400 py-4">
        This tool is a planning aid, not a substitute for professional tax advice or the official Income Tax
        Department e-filing portal.
      </footer>
    </div>
  );
}
