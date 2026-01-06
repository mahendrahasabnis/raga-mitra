import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/Layout/MainLayout';
import LoadingSpinner from './components/UI/LoadingSpinner';

// Dashboard Pages
import DoctorDashboard from './pages/Dashboards/DoctorDashboard';
import PatientDashboard from './pages/Dashboards/PatientDashboard';
import ReceptionistDashboard from './pages/Dashboards/ReceptionistDashboard';
import BillingDashboard from './pages/Dashboard/BillingDashboard';

// Master Data Pages
import ClinicsPage from './pages/MasterData/ClinicsPage';

// Patient Management Pages
import PatientManagement from './components/Patient/PatientManagement';

// HCP Management Pages
import HCPManagement from './components/HCP/HCPManagement';

// Appointment Management Pages
import AppointmentBooking from './components/Appointment/AppointmentBooking';
import AppointmentsPage from './pages/Appointments/AppointmentsPage';
import AppointmentDetails from './pages/Appointments/AppointmentDetails';

// Placeholder pages for other routes
const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-600">{description}</p>
    </div>
    <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h2>
      <p className="text-gray-600">This page is under development and will be available soon.</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Role-based Protected Route Component
const RoleProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requiredRoles: string[];
  requiredPermissions?: string[];
}> = ({ children, requiredRoles, requiredPermissions = [] }) => {
  const { user, isLoading, hasRole, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has any of the required roles
  const hasRequiredRole = requiredRoles.some(role => hasRole(role));
  
  // Check if user has any of the required permissions
  const hasRequiredPermission = requiredPermissions.length === 0 || 
    requiredPermissions.some(permission => hasPermission(permission));

  if (!hasRequiredRole || !hasRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">
            Required roles: {requiredRoles.join(', ')}
            {requiredPermissions.length > 0 && (
              <span><br />Required permissions: {requiredPermissions.join(', ')}</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Main App Content
const AppContent: React.FC = () => {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MainLayout>
      <Routes>
        {/* Dashboard Routes */}
        <Route path="/dashboard/doctor" element={
          <RoleProtectedRoute requiredRoles={['doctor']} requiredPermissions={[]}>
            <DoctorDashboard />
          </RoleProtectedRoute>
        } />
        <Route path="/dashboard/patient" element={<PatientDashboard />} />
        <Route path="/dashboard/reception" element={<ReceptionistDashboard />} />
        <Route path="/dashboard/billing" element={<BillingDashboard />} />
        
        {/* Master Data Routes - These are handled within HCP Management */}
        <Route path="/clinics" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin', 'reception']} requiredPermissions={['view_clinics']}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/clinics/add" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin']} requiredPermissions={['manage_clinics']}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/practices" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin', 'reception']} requiredPermissions={['view_practices']}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/practices/add" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin']} requiredPermissions={['manage_practices']}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/doctors" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin', 'reception']} requiredPermissions={['view_doctors']}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/services" element={
          <PlaceholderPage 
            title="Services" 
            description="Manage healthcare services and pricing" 
          />
        } />
        
        {/* Patient Management Routes */}
        <Route path="/patients/*" element={<PatientManagement />} />
        
        {/* HCP Management Routes */}
        <Route path="/hcp" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin']} requiredPermissions={[]}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/hcp/register" element={
          <RoleProtectedRoute requiredRoles={['owner', 'clinic_admin', 'admin']} requiredPermissions={[]}>
            <HCPManagement />
          </RoleProtectedRoute>
        } />
        
        {/* Staff Management Routes */}
        <Route path="/staff/receptionists" element={
          <PlaceholderPage 
            title="Receptionists" 
            description="Manage reception staff and their assignments" 
          />
        } />
        <Route path="/staff/doctors" element={
          <PlaceholderPage 
            title="Doctors" 
            description="Manage doctor staff and their assignments" 
          />
        } />
        <Route path="/staff/duties" element={
          <PlaceholderPage 
            title="Duty Scheduling" 
            description="Schedule reception staff duties and shifts" 
          />
        } />
        
        {/* Appointment Routes */}
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/appointments/:appointmentId" element={<AppointmentDetails />} />
        <Route path="/appointments/book" element={<AppointmentBooking onSuccess={() => {}} onCancel={() => {}} />} />
        <Route path="/appointments/schedule" element={
          <PlaceholderPage 
            title="Schedule Management" 
            description="Manage appointment schedules and availability" 
          />
        } />
        
        {/* Medical Records Routes */}
        <Route path="/medical-records/patients" element={
          <PlaceholderPage 
            title="Patient Records" 
            description="View and manage patient medical records" 
          />
        } />
        <Route path="/medical-records/my-records" element={
          <PlaceholderPage 
            title="My Medical Records" 
            description="View your personal medical records" 
          />
        } />
        <Route path="/medical-records/prescriptions" element={
          <PlaceholderPage 
            title="Prescriptions" 
            description="View and manage prescriptions" 
          />
        } />
        
        {/* Billing Routes */}
        <Route path="/billing/invoices" element={
          <PlaceholderPage 
            title="Invoices" 
            description="View and manage invoices" 
          />
        } />
        <Route path="/billing/payments" element={
          <PlaceholderPage 
            title="Payments" 
            description="View and manage payments" 
          />
        } />
        <Route path="/billing/reports" element={
          <PlaceholderPage 
            title="Billing Reports" 
            description="Generate and view billing reports" 
          />
        } />
        
        {/* Settings Routes */}
        <Route path="/settings/users" element={
          <PlaceholderPage 
            title="User Management" 
            description="Manage system users and permissions" 
          />
        } />
        <Route path="/settings/system" element={
          <PlaceholderPage 
            title="System Settings" 
            description="Configure system settings and preferences" 
          />
        } />
        
        {/* Default redirect based on user role */}
        <Route path="/" element={
          <Navigate to={
            hasRole('doctor') ? '/dashboard/doctor' :
            hasRole('reception') || hasRole('receptionist') ? '/dashboard/reception' :
            hasRole('billing') ? '/dashboard/billing' :
            hasRole('owner') || hasRole('admin') || hasRole('clinic_admin') ? '/hcp' : // Owners/admins go to HCP management
            '/dashboard/patient'
          } replace />
        } />
      </Routes>
    </MainLayout>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;