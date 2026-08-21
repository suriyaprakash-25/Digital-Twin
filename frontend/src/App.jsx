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
import GarageServicesHistory from './pages/GarageServicesHistory';
import GarageDetails from './pages/GarageDetails';
import GarageReviewsPage from './pages/GarageReviewsPage';
import PartnerSupport from './pages/PartnerSupport';
import PartnerHelpFAQ from './pages/PartnerHelpFAQ';
import PaymentHistory from './pages/PaymentHistory';
import GaragePayments from './pages/GaragePayments';
import GarageEarnings from './pages/GarageEarnings';
import GarageSettlements from './pages/GarageSettlements';
import MyDisputes from './pages/MyDisputes';
import DisputeDetails from './pages/DisputeDetails';
import GarageDisputes from './pages/GarageDisputes';
import GarageReports from './pages/GarageReports';

import { ToastProvider } from './context/ToastContext';

// Admin
import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGarages from './pages/admin/AdminGarages';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminPayments from './pages/admin/AdminPayments';
import AdminCommissions from './pages/admin/AdminCommissions';
import AdminSettlements from './pages/admin/AdminSettlements';
import AdminReconciliation from './pages/admin/AdminReconciliation';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminPaymentRisk from './pages/admin/AdminPaymentRisk';
import AdminFinancialReports from './pages/admin/AdminFinancialReports';
import AdminFinancialOperations from './pages/admin/AdminFinancialOperations';
import AdminFinancialAudit from './pages/admin/AdminFinancialAudit';
import AdminTreasury from './pages/admin/AdminTreasury';
import AdminTaxCompliance from './pages/admin/AdminTaxCompliance';
import AdminRiskCases from './pages/admin/AdminRiskCases';
import GarageTax from './pages/GarageTax';

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
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/commissions" element={<AdminCommissions />} />
          <Route path="/admin/settlements" element={<AdminSettlements />} />
          <Route path="/admin/treasury" element={<AdminTreasury />} />
          <Route path="/admin/financial-operations" element={<AdminFinancialOperations />} />
          <Route path="/admin/financial-audit" element={<AdminFinancialAudit />} />
          <Route path="/admin/tax-compliance" element={<AdminTaxCompliance />} />
          <Route path="/admin/risk-cases" element={<AdminRiskCases />} />
          <Route path="/admin/reconciliation" element={<AdminReconciliation />} />
          <Route path="/admin/disputes" element={<AdminDisputes />} />
          <Route path="/admin/payment-risk" element={<AdminPaymentRisk />} />
          <Route path="/admin/financial-reports" element={<AdminFinancialReports />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/garages" element={<AdminGarages />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
          <Route path="/admin/feedback" element={<AdminFeedback />} />
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
          <Route path="/partner-support" element={<PartnerSupport />} />
          <Route path="/help-faq" element={<PartnerHelpFAQ />} />

          {/* AI Vehicle Doctor */}
          <Route path="/vehicle-doctor" element={<VehicleDoctor />} />
          <Route path="/vehicle-doctor/history" element={<DiagnosisHistory />} />

          {/* Legacy driveportz routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-vehicle" element={<AddVehicle />} />
          <Route path="/edit-vehicle/:id" element={<EditVehicle />} />
          <Route path="/my-vehicles" element={<MyVehicles />} />
          <Route path="/payment-history" element={<PaymentHistory />} />
          <Route path="/disputes" element={<MyDisputes />} />
          <Route path="/disputes/:id" element={<DisputeDetails />} />
          <Route path="/add-service" element={<AddService />} />
          <Route path="/service-history/:vehicleId" element={<ServiceHistory />} />
          <Route path="/resale-report/:vehicleId" element={<ResaleReport />} />
          <Route path="/insurance/:vehicleId" element={<Insurance />} />
          <Route path="/transfer/:vehicleId" element={<TransferOwnership />} />
          <Route path="/garage-portal" element={<GaragePortal />} />
          <Route path="/garage-profile" element={<GarageProfile />} />
          <Route path="/garage-services" element={<GarageServices />} />
          <Route path="/garage-services-history" element={<GarageServicesHistory />} />
          <Route path="/garage/payments" element={<GaragePayments />} />
          <Route path="/garage/earnings" element={<GarageEarnings />} />
          <Route path="/garage/settlements" element={<GarageSettlements />} />
          <Route path="/garage/reports" element={<GarageReports />} />
          <Route path="/garage/tax" element={<GarageTax />} />
          <Route path="/garage/disputes" element={<GarageDisputes />} />
          <Route path="/garage-availability" element={<GarageAvailability />} />
          <Route path="/garages/:garageId" element={<GarageDetails />} />
          <Route path="/garage/reviews" element={<GarageReviewsPage />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;

