import { createBrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/DashboardPage";
import Account from "./pages/AccountPage";

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
    element: <Dashboard />,
  },

  // Account Page
  {
    path: "/account",
    element: <Account />,
  },
]);

export default router;
