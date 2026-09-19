import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { TaxReturnProvider } from "./context/TaxReturnContext";
import { Dashboard } from "./pages/Dashboard";
import { Deductions } from "./pages/Deductions";
import { Income } from "./pages/Income";
import { Login } from "./pages/Login";
import { PersonalInfo } from "./pages/PersonalInfo";
import { Register } from "./pages/Register";
import { Summary } from "./pages/Summary";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <ProtectedRoute>
              <TaxReturnProvider>
                <Layout />
              </TaxReturnProvider>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/personal-info" element={<PersonalInfo />} />
          <Route path="/income" element={<Income />} />
          <Route path="/deductions" element={<Deductions />} />
          <Route path="/summary" element={<Summary />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
