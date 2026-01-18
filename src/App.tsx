import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ClientPortal from "@/pages/ClientPortal";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import NetworkConfigPage from "@/pages/NetworkConfigPage";

// Admin route guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  return token ? <>{children}</> : <Navigate to="/admin" replace />;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Client Portal */}
        <Route path="/" element={<ClientPortal />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/network" 
          element={
            <AdminRoute>
              <NetworkConfigPage />
            </AdminRoute>
          } 
        />
        
        {/* Catch all - redirect to client portal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}