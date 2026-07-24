import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AddVehicle from './pages/AddVehicle';
import MyVehicles from './pages/MyVehicles';
import AddService from './pages/AddService';
import ServiceHistory from './pages/ServiceHistory';
import EditVehicle from './pages/EditVehicle';
import ResaleReport from './pages/ResaleReport';
import GaragePortal from './pages/GaragePortal';
import Analytics from './pages/Analytics';
import UserDashboard from './pages/UserDashboard';
import GarageDashboard from './pages/GarageDashboard';
import GarageProfile from './pages/GarageProfile';
import GarageServices from './pages/GarageServices';
import Marketplace from './pages/Marketplace';
import MyProfile from './pages/MyProfile';
import Passport from './pages/Passport';
import Insurance from './pages/Insurance';
import TransferOwnership from './pages/TransferOwnership';
import VehicleDoctor from './pages/VehicleDoctor';
import DiagnosisHistory from './pages/DiagnosisHistory';
import GarageAvailability from './pages/GarageAvailability';
import FleetsPage from './pages/FleetsPage';
import GaragePartnersPage from './pages/GaragePartnersPage';

import { ToastProvider } from './context/ToastContext';

// Admin
import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGarages from './pages/admin/AdminGarages';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminAnalytics from './pages/admin/AdminAnalytics';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/fleets" element={<FleetsPage />} />
        <Route path="/garage-partners" element={<GaragePartnersPage />} />
        <Route path="/passport/:vehicleId" element={<Passport />} />

        {/* Admin routes */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/garages" element={<AdminGarages />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
        </Route>

        {/* Protected Dashboard Routes — pathless layout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/my-profile" element={<MyProfile />} />
          <Route path="/garage-dashboard" element={<GarageDashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />

          {/* AI Vehicle Doctor */}
          <Route path="/vehicle-doctor" element={<VehicleDoctor />} />
          <Route path="/vehicle-doctor/history" element={<DiagnosisHistory />} />

          {/* Legacy driveportz routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-vehicle" element={<AddVehicle />} />
          <Route path="/edit-vehicle/:id" element={<EditVehicle />} />
          <Route path="/my-vehicles" element={<MyVehicles />} />
          <Route path="/add-service" element={<AddService />} />
          <Route path="/service-history/:vehicleId" element={<ServiceHistory />} />
          <Route path="/resale-report/:vehicleId" element={<ResaleReport />} />
          <Route path="/insurance/:vehicleId" element={<Insurance />} />
          <Route path="/transfer/:vehicleId" element={<TransferOwnership />} />
          <Route path="/garage-portal" element={<GaragePortal />} />
          <Route path="/garage-profile" element={<GarageProfile />} />
          <Route path="/garage-services" element={<GarageServices />} />
          <Route path="/garage-availability" element={<GarageAvailability />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;

