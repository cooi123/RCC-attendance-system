import { Route, Routes } from "react-router-dom";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminLoginPage } from "@/pages/AdminLoginPage";
import { AttendancePage } from "@/pages/AttendancePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AttendancePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
    </Routes>
  );
}
