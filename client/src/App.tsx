import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import MapPage from './pages/MapPage';
import { useAuthStore } from './store/authStore';

// רכיב שמגן על נתיבים שדורשים התחברות
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

        {/* דף המפה מוגן - רק מי שמחובר יכול להיכנס */}
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />

        {/* ברירת מחדל: הפנייה למפה (שתזרוק ללוגין אם לא מחוברים) */}
        <Route path="*" element={<Navigate to="/map" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;