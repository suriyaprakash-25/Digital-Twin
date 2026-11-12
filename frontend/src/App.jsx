import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import PageLoader from './components/common/PageLoader';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authContextCore';
import { FEATURES } from './config/features';
import { ROLES, homePathForRole } from './utils/roles';

// Every page is its own chunk; layouts and guards stay in the entry bundle.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const FleetsPage = lazy(() => import('./pages/FleetsPage'));
const GaragePartnersPage = lazy(() => import('./pages/GaragePartnersPage'));
const Passport = lazy(() => import('./pages/Passport'));
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const PartnerSupport = lazy(() => import('./pages/PartnerSupport'));
const PartnerHelpFAQ = lazy(() => import('./pages/PartnerHelpFAQ'));
const VehicleDoctor = lazy(() => import('./pages/VehicleDoctor'));
const DiagnosisHistory = lazy(() => import('./pages/DiagnosisHistory'));
const AddVehicle = lazy(() => import('./pages/AddVehicle'));
const EditVehicle = lazy(() => import('./pages/EditVehicle'));
const MyVehicles = lazy(() => import('./pages/MyVehicles'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const PaymentCenter = lazy(() => import('./pages/PaymentCenter'));
const MyDisputes = lazy(() => import('./pages/MyDisputes'));
const AddService = lazy(() => import('./pages/AddService'));
const ServiceHistory = lazy(() => import('./pages/ServiceHistory'));
const ResaleReport = lazy(() => import('./pages/ResaleReport'));
const Insurance = lazy(() => import('./pages/Insurance'));
const TransferOwnership = lazy(() => import('./pages/TransferOwnership'));
const GarageDetails = lazy(() => import('./pages/GarageDetails'));
const Analytics = lazy(() => import('./pages/Analytics'));

const GarageDashboard = lazy(() => import('./pages/GarageDashboard'));
const GaragePortal = lazy(() => import('./pages/GaragePortal'));
const GarageProfile = lazy(() => import('./pages/GarageProfile'));
const GarageServices = lazy(() => import('./pages/GarageServices'));
const GarageServicesHistory = lazy(() => import('./pages/GarageServicesHistory'));
const GaragePayments = lazy(() => import('./pages/GaragePayments'));
const GarageEarnings = lazy(() => import('./pages/GarageEarnings'));
const GarageFinancialCenter = lazy(() => import('./pages/GarageFinancialCenter'));
const GarageSettlements = lazy(() => import('./pages/GarageSettlements'));
const GarageReports = lazy(() => import('./pages/GarageReports'));
const GarageTax = lazy(() => import('./pages/GarageTax'));
const GarageAvailability = lazy(() => import('./pages/GarageAvailability'));
const GarageReviewsPage = lazy(() => import('./pages/GarageReviewsPage'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminGarages = lazy(() => import('./pages/admin/AdminGarages'));
const AdminRevenue = lazy(() => import('./pages/admin/AdminRevenue'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminPilotOperations = lazy(() => import('./pages/admin/AdminPilotOperations'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminCommissions = lazy(() => import('./pages/admin/AdminCommissions'));
const AdminSettlements = lazy(() => import('./pages/admin/AdminSettlements'));
const AdminReconciliation = lazy(() => import('./pages/admin/AdminReconciliation'));
const AdminDisputes = lazy(() => import('./pages/admin/AdminDisputes'));
const AdminPaymentRisk = lazy(() => import('./pages/admin/AdminPaymentRisk'));
const AdminFinancialReports = lazy(() => import('./pages/admin/AdminFinancialReports'));
const AdminFinancialOperations = lazy(() => import('./pages/admin/AdminFinancialOperations'));
const AdminFinancialAudit = lazy(() => import('./pages/admin/AdminFinancialAudit'));
const AdminTreasury = lazy(() => import('./pages/admin/AdminTreasury'));
const AdminTaxCompliance = lazy(() => import('./pages/admin/AdminTaxCompliance'));
const AdminRiskCases = lazy(() => import('./pages/admin/AdminRiskCases'));
const AdminFinancialAlerts = lazy(() => import('./pages/admin/AdminFinancialAlerts'));
const AdminFinancialOperationsDashboard = lazy(() => import('./pages/admin/AdminFinancialOperationsDashboard'));

const USER_ONLY = [ROLES.USER];
const GARAGE_ONLY = [ROLES.GARAGE];

const DashboardRedirect = () => {
  const { role } = useAuth();
  return <Navigate to={homePathForRole(role)} replace />;
};

/** Role-gated element inside the signed-in layout. */
const Gate = ({ roles, children }) => <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>;

const NotFound = () => (
  <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900">
    <h1 className="text-4xl font-extrabold mb-2">404</h1>
    <p className="text-lg text-slate-500 font-medium mb-4">Page not found</p>
    <a href="/" className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition">Go Home</a>
  </main>
);

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader fullScreen />}>
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
              <Route path="/payment-return" element={<PaymentReturn />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />

              {/* Admin routes */}
              <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/financial-command-center" element={<AdminFinancialOperationsDashboard />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
                <Route path="/admin/commissions" element={<AdminCommissions />} />
                <Route path="/admin/settlements" element={<AdminSettlements />} />
                <Route path="/admin/treasury" element={<AdminTreasury />} />
                <Route path="/admin/financial-operations" element={<AdminFinancialOperations />} />
                <Route path="/admin/financial-audit" element={<AdminFinancialAudit />} />
                <Route path="/admin/tax-compliance" element={<AdminTaxCompliance />} />
                <Route path="/admin/risk-cases" element={<AdminRiskCases />} />
                <Route path="/admin/financial-alerts" element={<AdminFinancialAlerts />} />
                <Route path="/admin/reconciliation" element={<AdminReconciliation />} />
                <Route path="/admin/disputes" element={<AdminDisputes />} />
                <Route path="/admin/payment-risk" element={<AdminPaymentRisk />} />
                <Route path="/admin/financial-reports" element={<AdminFinancialReports />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/garages" element={<AdminGarages />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/revenue" element={<AdminRevenue />} />
                <Route path="/admin/feedback" element={<AdminFeedback />} />
                <Route path="/admin/pilot-operations" element={<AdminPilotOperations />} />
              </Route>

              {/* Signed-in routes (owner + garage) */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {/* Shared */}
                <Route path="/dashboard" element={<DashboardRedirect />} />
                <Route path="/my-profile" element={<MyProfile />} />
                <Route path="/partner-support" element={<PartnerSupport />} />
                <Route path="/help-faq" element={<PartnerHelpFAQ />} />
                <Route path="/add-service" element={<AddService />} />
                <Route path="/service-history/:vehicleId" element={<ServiceHistory />} />
                <Route path="/garages/:garageId" element={<GarageDetails />} />
                <Route path="/analytics" element={<Analytics />} />

                {/* Vehicle owner */}
                <Route path="/user-dashboard" element={<Gate roles={USER_ONLY}><UserDashboard /></Gate>} />
                <Route path="/marketplace" element={<Gate roles={USER_ONLY}><Marketplace /></Gate>} />
                <Route path="/add-vehicle" element={<Gate roles={USER_ONLY}><AddVehicle /></Gate>} />
                <Route path="/edit-vehicle/:id" element={<Gate roles={USER_ONLY}><EditVehicle /></Gate>} />
                <Route path="/my-vehicles" element={<Gate roles={USER_ONLY}><MyVehicles /></Gate>} />
                <Route path="/payment-history" element={<Gate roles={USER_ONLY}><PaymentHistory /></Gate>} />
                <Route path="/payments" element={<Gate roles={USER_ONLY}><PaymentCenter /></Gate>} />
                <Route path="/customer/payments" element={<Gate roles={USER_ONLY}><PaymentCenter /></Gate>} />
                <Route path="/my-disputes" element={<Gate roles={USER_ONLY}><MyDisputes /></Gate>} />
                <Route path="/resale-report/:vehicleId" element={<Gate roles={USER_ONLY}><ResaleReport /></Gate>} />
                <Route path="/insurance/:vehicleId" element={<Gate roles={USER_ONLY}><Insurance /></Gate>} />
                <Route path="/transfer/:vehicleId" element={<Gate roles={USER_ONLY}><TransferOwnership /></Gate>} />
                {FEATURES.AI_DOCTOR && (
                  <>
                    <Route path="/vehicle-doctor" element={<Gate roles={USER_ONLY}><VehicleDoctor /></Gate>} />
                    <Route path="/vehicle-doctor/history" element={<Gate roles={USER_ONLY}><DiagnosisHistory /></Gate>} />
                  </>
                )}

                {/* Garage partner */}
                <Route path="/garage-dashboard" element={<Gate roles={GARAGE_ONLY}><GarageDashboard /></Gate>} />
                <Route path="/garage/add-service" element={<Gate roles={GARAGE_ONLY}><AddService /></Gate>} />
                <Route path="/garage-portal" element={<Gate roles={GARAGE_ONLY}><GaragePortal /></Gate>} />
                <Route path="/garage-profile" element={<Gate roles={GARAGE_ONLY}><GarageProfile /></Gate>} />
                <Route path="/garage-services" element={<Gate roles={GARAGE_ONLY}><GarageServices /></Gate>} />
                <Route path="/garage-services-history" element={<Gate roles={GARAGE_ONLY}><GarageServicesHistory /></Gate>} />
                <Route path="/garage/payments" element={<Gate roles={GARAGE_ONLY}><GaragePayments /></Gate>} />
                <Route path="/garage/earnings" element={<Gate roles={GARAGE_ONLY}><GarageEarnings /></Gate>} />
                <Route path="/garage/financial-center" element={<Gate roles={GARAGE_ONLY}><GarageFinancialCenter /></Gate>} />
                <Route path="/garage/settlements" element={<Gate roles={GARAGE_ONLY}><GarageSettlements /></Gate>} />
                <Route path="/garage/reports" element={<Gate roles={GARAGE_ONLY}><GarageReports /></Gate>} />
                <Route path="/garage/tax" element={<Gate roles={GARAGE_ONLY}><GarageTax /></Gate>} />
                <Route path="/garage-availability" element={<Gate roles={GARAGE_ONLY}><GarageAvailability /></Gate>} />
                <Route path="/garage/reviews" element={<Gate roles={GARAGE_ONLY}><GarageReviewsPage /></Gate>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
