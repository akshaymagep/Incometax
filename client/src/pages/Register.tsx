import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h1 className="text-xl font-bold text-brand-600 mb-1">Create your account</h1>
        <p className="text-sm text-slate-500 mb-6">Start planning your income tax return.</p>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}
        <label className="block mb-3">
          <span className="text-sm font-medium">Full name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block mb-6">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-slate-400">At least 8 characters</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 text-white py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-sm text-slate-500 mt-4 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
