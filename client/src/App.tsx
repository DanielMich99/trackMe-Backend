import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import MapPage from './pages/MapPage';
import AreasPage from './pages/AreasPage';
import { useAuthStore } from './store/authStore';

// Component that protects routes requiring authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected map page */}
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />

        {/* Protected areas management page */}
        <Route
          path="/areas"
          element={
            <ProtectedRoute>
              <AreasPage />
            </ProtectedRoute>
          }
        />

        {/* Default: redirect to map */}
        <Route path="*" element={<Navigate to="/map" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;