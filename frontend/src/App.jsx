import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="/add-vehicle" element={<AddVehicle />} />
          <Route path="/edit-vehicle/:id" element={<EditVehicle />} />
          <Route path="/my-vehicles" element={<MyVehicles />} />
          <Route path="add-service" element={<AddService />} />
          <Route path="service-history/:vehicleId" element={<ServiceHistory />} />
          <Route path="resale-report/:vehicleId" element={<ResaleReport />} />
          <Route path="/garage-portal" element={<GaragePortal />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
