import { createBrowserRouter } from "react-router-dom";
import { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardLayout from "./pages/DashboardPage";
import Account from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";

function ProtectRoutes() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userInfo = await fetch("api/current_user/", {
          method: "GET",
          credentials: "include",
        });

        if (!userInfo.ok) {
          setIsAuthenticated(false);
          return;
        }

        const user = await userInfo.json();
        setIsAuthenticated(!!user.username);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) return <p>Loading...</p>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return <Outlet />;
}

const router = createBrowserRouter([
  // Public routes
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },

  // Protected routes
  {
    element: <ProtectRoutes />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardLayout />,
      },
      {
        path: "/account",
        element: <Account />,
      },
      {
        path: "/admin",
        element: <AdminPage />,
      },
    ],
  },
]);

export default router;
