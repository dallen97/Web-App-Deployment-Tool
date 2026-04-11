import { Container } from "react-bootstrap";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; // Need this for Header links
import { Form, Button, Alert } from "react-bootstrap";
import PasswordChecker from "../components/PasswordChecker";

function getCookie(name: string) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Interfaces
interface RegisterPayload {
  username: string;
  password: string;
}
interface RegisterSuccessResponse {
  status: string;
  message: string;
  user_id: number;
}
interface RegisterErrorResponse {
  error: string;
}

type RegisterResponse = RegisterSuccessResponse | RegisterErrorResponse;

// API call
function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false); // Show or not show password
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false); //message while loading
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState<string>("");
  const navigate = useNavigate();

  // get CSRF token from backend (and set cookie for same origin)
  useEffect(() => {
    fetch("/api/get_csrf_token/", { method: "GET", credentials: "include" })
      .then((res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) return res.json();
        return null;
      })
      .then(
        (data: { csrfToken?: string } | null) =>
          data?.csrfToken && setCsrfToken(data.csrfToken),
      )
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // Password / form checking
    if (!username || !password || !passwordConfirmation) {
      setError("All fields are required");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Create payload
      const payload: RegisterPayload = {
        username,
        password,
      };

      const token = csrfToken || getCookie("wadt_csrftoken") || "";
      const response = await fetch("/api/register_user/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": token,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      const data = contentType?.includes("application/json")
        ? ((await response.json()) as RegisterResponse)
        : {
            error:
              response.status === 403
                ? "Invalid or missing CSRF token."
                : "Request failed.",
          };

      // Direct to login page if working correctly
      if (response.ok) {
        const successData = data as RegisterSuccessResponse;
        console.log("User created successfully:", successData.message);
        console.log("User ID:", successData.user_id);
        setSuccessMessage("Account created successfully!");
      } else {
        const errorData = data as RegisterErrorResponse;
        setError(errorData.error);
      }
    } catch (err) {
      console.error("Registration error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      {/*Titleblock}         
            <h1 className="display-4 font-monospace text-center" style = {{marginTop: "20vh"}}>
                Get started with WADT
            </h1>*/}
      <div className="d-flex justify-content-center align-items-center">
        {/*Title*/}
        <Form
          className="loginForm rounded-3 p-5 pt-2 border border-secondary"
          style={{ marginTop: "15vh" }}
          onSubmit={handleSubmit}
        >
          <h1 className="font-monospace text-center">Get Started with WADT</h1>

          {/*Success display*/}
          {successMessage && (
            <Alert
              variant="success"
              onClose={() => setSuccessMessage("")}
              dismissible
            >
              {successMessage}
            </Alert>
          )}

          {/*Error display */}
          {error && (
            <Alert variant="danger" onClose={() => setError("")} dismissible>
              {error}
            </Alert>
          )}

          {/*Fill out username block*/}
          <Form.Group className="mb-4" controlId="formUsername">
            <Form.Control
              type="text"
              placeholder="Choose a Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            ></Form.Control>
          </Form.Group>

          {/*Create password block (first)*/}
          <Form.Group className="mb-4" controlId="formPassword">
            <Form.Control
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            ></Form.Control>
          </Form.Group>

          {/*Confirm password*/}
          <Form.Group className="mb-2 lh-sm" controlId="formConfirmPassword">
            <Form.Control
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm Password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              disabled={isLoading}
            ></Form.Control>
          </Form.Group>

          {/*Password complexity guage and visual password matching confirmation */}
          <PasswordChecker password={password} />
          {passwordConfirmation && (
            <span
              style={{
                color:
                  password === passwordConfirmation ? "#00ff00" : "#ff0000",
              }}
            >
              {password === passwordConfirmation
                ? "Passwords match"
                : "Passwords do not match"}
            </span>
          )}
          {/*Show passwords checkbox*/}
          <Form.Group className="mb-2" controlId="showPasswordCheckBox">
            <Form.Check
              className="font-monospace fs-5"
              type="checkbox"
              label="Show Passwords"
              checked={showPassword}
              onChange={() => setShowPassword((prev) => !prev)}
            />
          </Form.Group>

          {/*Create account button*/}
          <div className="d-grid">
            {successMessage === "" ? (
              <Button
                className="font-monospace fs-4 "
                variant="secondary"
                type="submit"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            ) : (
              <Button
                className="font-monospace fs-4 "
                variant="success"
                size="lg"
                onClick={() => navigate("/login")}
              >
                Login
              </Button>
            )}
          </div>

          {/*Link to login page without an account*/}
          <div className="text-center mt-2 lh-sm">
            {successMessage.length === 0 && (
              <>
                <span className="font-monospace fs-5">
                  Already have an account?{" "}
                </span>
                <br />
                <Link to="/login" className="font-monospace fs-5">
                  Click here to login
                </Link>
              </>
            )}
          </div>
        </Form>
      </div>
    </Container>
  );
}
export default RegisterPage;
