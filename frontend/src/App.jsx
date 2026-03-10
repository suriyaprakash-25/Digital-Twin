import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
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
import Marketplace from './pages/Marketplace';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Dashboard Routes — pathless layout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/garage-dashboard" element={<GarageDashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />

          {/* Legacy digital twin routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-vehicle" element={<AddVehicle />} />
          <Route path="/edit-vehicle/:id" element={<EditVehicle />} />
          <Route path="/my-vehicles" element={<MyVehicles />} />
          <Route path="/add-service" element={<AddService />} />
          <Route path="/service-history/:vehicleId" element={<ServiceHistory />} />
          <Route path="/resale-report/:vehicleId" element={<ResaleReport />} />
          <Route path="/garage-portal" element={<GaragePortal />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
