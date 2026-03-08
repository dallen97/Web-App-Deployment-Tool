import { createBrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./components/DashboardLayout";
import Account from "./pages/AccountPage";
import DashboardLayout from "./components/DashboardLayout";

//Create routes for the website

const router = createBrowserRouter([
  {
    // Landing Page
    path: "/",
    element: <LandingPage />,
    children: [],
  },
  // Login Page
  {
    path: "/login",
    element: <LoginPage />,
  },
  // Registration Page
  {
    path: "/register",
    element: <RegisterPage />,
  },

  // Dashboard Page
  {
    path: "/dashboard",
    element: <DashboardLayout />,
  },

  // Account Page
  {
    path: "/account",
    element: <Account />,
  },
]);

export default router;
