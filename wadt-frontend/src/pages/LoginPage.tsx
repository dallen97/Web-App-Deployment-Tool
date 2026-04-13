import { Container } from "react-bootstrap";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; // Need this for Header links
import { Form, Button, Alert } from "react-bootstrap";

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
interface LoginPayload {
  username: string;
  password: string;
}
interface LoginSuccessResponse {
  status: string;
  message: string;
  user_id: number;
  username: string;
}
interface LoginErrorResponse {
  error: string;
}

type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

function LoginPage() {
  // Login Page states
  const [showPassword, setShowPassword] = useState(false); // Show or not show password
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState<string>("");
  const navigate = useNavigate();

  // MFA related states
  const [loginStage, setLoginStage] = useState<"login" | "mfa_required" | "mfa_setup">("login");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSession, setMfaSession] = useState(""); // Needed for submitting mfa code
  const [secretCode, setSecretCode] = useState("") // returned cognito code
  const [qrCodeUri, setQrCodeUri] = useState(""); // generate QR code

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

  // Handle login form inputs
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    // Missing field
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setIsLoading(true);
    try {
      const payload: LoginPayload = {
        username,
        password,
      };

      const token = csrfToken || getCookie("wadt_csrftoken") || "";
      const response = await fetch("/api/login_user/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": token,
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      const data = contentType?.includes("application/json")
        ? ((await response.json()) as LoginResponse)
        : {
            error:
              response.status === 403
                ? "Invalid or missing CSRF token."
                : "Request failed.",
          };
      
      // After successful login attempted
      if (response.ok) {
        const successData = data as any;
        // User has MFA set up
        if (successData.status === "MFA_REQUIRED") {
          setMfaSession(successData.session);
          setLoginStage("mfa_required");
        } 

        // First time login (user needs to set up MFA)
        else if (successData.status === "MFA_SETUP_REQUIRED") {
          const setupRes = await fetch("/api/setup_mfa/", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRFToken": token },
            body: JSON.stringify({ username })
          });
          // Save the secret key and QR code
          const setupData = await setupRes.json();
          setSecretCode(setupData.secretCode);
          setQrCodeUri(setupData.qrCodeUri);
          setLoginStage("mfa_setup");

        } 
        // Login successful
        else {
          const profileRes = await fetch("/api/current_user/", { credentials: "include" });
          const profileData = await profileRes.json();
          navigate(profileData.role === "SUPER" ? "/admin" : "/dashboard");
        }

      } else {
        const errorData = data as LoginErrorResponse;
        setError(errorData.error);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to login.");
    } finally {
      setIsLoading(false);
    }
  };

  // Send mfa code and session token to Cognito
    const handleMfaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = csrfToken || getCookie("wadt_csrftoken") || "";
      const response = await fetch("/api/verify_mfa_login/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify({ username, mfaCode, session: mfaSession })
      });
      const data = await response.json();
      if (response.ok) 
        navigate("/dashboard");
      else
        setError(data.error);
    }
    catch {
      setError("Unable to verify MFA code.");
    }
    finally {
      setIsLoading(false); 
    };
  };

    const handleMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = csrfToken || getCookie("wadt_csrftoken") || "";
      const response = await fetch("/api/verify_mfa_setup/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify({ username, mfaCode })
      });
      const data = await response.json();
      if (response.ok) 
        navigate("/dashboard");
      else 
        setError(data.error);
    } 
    catch {
      setError("Unable to verify MFA setup.");
    } 
    finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <div className="d-flex justify-content-center align-items-center">
        {/*Normal Login Stage  (default)*/}
        {loginStage === "login" &&
        <Form className="loginForm rounded-3 p-5 pt-2 border border-secondary"style={{ marginTop: "15vh" }} onSubmit={handleSubmit}>
          <h1 className="font-monospace text-center">Login</h1>
          {/*Error display */}
          {error && (
            <Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>)}
          {/*Username block*/}
          <Form.Group className="mb-4" controlId="formUsername">
            {/*<Form.Label className = "font-monospace fs-4"></Form.Label>*/}
            <Form.Control
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            ></Form.Control>
          </Form.Group>

          {/*Password block*/}
          <Form.Group className="mb-2" controlId="formPassword">
            <Form.Control
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            ></Form.Control>
          </Form.Group>

          {/*Show password checkbox*/}
          <Form.Group className="mb-4" controlId="showPasswordCheckBox">
            <Form.Check
              className="font-monospace fs-5"
              type="checkbox"
              label="Show Password"
              checked={showPassword}
              onChange={() => setShowPassword((prev) => !prev)}
            />
          </Form.Group>

          {/*Login button*/}
          <div className="d-grid">
            <Button
              className="font-monospace fs-4"
              variant="secondary"
              type="submit"
              size="lg"
              disabled={isLoading}>
              {isLoading ? "Logging in..." : "Start"}
            </Button>
          </div>

          {/*Link to registration page*/}
          <div className="text-center mt-2 lh-sm">
            <span className="font-monospace fs-5">Don't have an account? </span>
            <br />
            <Link to="/register" className="font-monospace fs-5">Sign up here</Link>
          </div>
        </Form>
        }

        {/* After First Login */}
        {loginStage === "mfa_required" && (
          <Form
            className="loginForm rounded-3 p-5 pt-2 border border-secondary"
            style={{ marginTop: "15vh" }}
            onSubmit={handleMfaLogin}>
            <h1 className="font-monospace text-center">Enter Authenticator Code</h1>
            {error && (
              <Alert variant="danger" onClose={() => setError("")} dismissible>
                {error}
              </Alert>
            )}
            <p className="text-center">Enter the 6-digit code from your authenticator app.</p>
            {/* MFA code input */}
            <Form.Group className="mb-4">
              <Form.Control
                type="text"
                placeholder="000000"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                disabled={isLoading}
              />
            </Form.Group>

            <div className="d-grid">
              <Button variant="secondary" type="submit" size="lg" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </Form>
        )
      }
      {/* First Time Login (need to setup mfa)*/}
      {loginStage === "mfa_setup" && (
        <Form
          className="loginForm rounded-3 p-5 pt-2 border border-secondary"
          style={{ marginTop: "15vh" }}
          onSubmit={handleMfaSetup}>

          <h1 className="font-monospace text-center">Enter Authenticator Code</h1>
          {error && (<Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>)}

          {/* QR code image generated*/}
          <p className="text-center">Scan this QR code with your authenticator app. </p>
          <div className="text-center mb-3">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCodeUri)}&size=200x200`}
              alt="QR Code"
            />
          </div>
          {/* Manual entry in case cant scan QR code */}
          <p className="text-center small">Can't scan? Open your authenticator app, choose <strong>"Enter setup key"</strong>, and enter this key: <strong>{secretCode}</strong></p>
          {/* input code to confirm setup */}
          <Form.Group className="mb-4">
            <Form.Control
              type="text"
              placeholder="000000"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              disabled={isLoading}/>
          </Form.Group>

          <div className="d-grid">
            <Button variant="secondary" type="submit" size="lg" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Confirm Code"}
            </Button>
          </div>
        </Form>
        )}
      </div>
    </Container>
  );
}
export default LoginPage;
