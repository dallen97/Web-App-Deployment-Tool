import { Container } from 'react-bootstrap';
import {useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom'; // Need this for Header links
import {Form, Button, Alert} from "react-bootstrap"

function getCookie(name: string) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Interfaces for type safety
interface LoginPayload 
{
    username: string;
    password: string;
}
interface LoginSuccessResponse 
{
    status: string;
    message: string;
    user_id: number;
    username: string;
}
interface LoginErrorResponse 
{
    error: string;
}

type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

function LoginPage(){
    const [showPassword, setShowPassword] = useState(false); // Show or not show password
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    // get csrf cookie
    useEffect(() => {
        // fetch this endpoint just to force Django to send the 'Set-Cookie' header
        fetch('/wadtapp/auth/csrf/', { 
            method: 'GET', 
            credentials: 'include' 
        }).catch(err => console.log("CSRF Ping failed (server might be down):", err));
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        // Missing field
        if (!username || !password) {
            setError('Username and password are required');
            return;
        }

        setIsLoading(true);

        try {
            // Create payload
            const payload: LoginPayload =
            {
                username,
                password
            };

            const response = await fetch('/wadtapp/auth/login/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') || '',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json() as LoginResponse;

            if (response.ok) {
                const successData = data as LoginSuccessResponse;
                console.log('Login successful:', successData.message);
                console.log('User ID:', successData.user_id);
                navigate('/'); 
            } else {
                const errorData = data as LoginErrorResponse;
                setError(errorData.error);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Unable to login.');
        } finally {
            setIsLoading(false);
        }
    };

    return(
        <Container>
            {/*Title block, might make subtitle later if we get a real app name        
            <h1 className="display-4 font-monospace text-center" style = {{marginTop: "15vh"}}>
                Sign in to your account
            </h1>
            */}
            <div className= "d-flex justify-content-center align-items-center">

            <Form className = "loginForm rounded-3 p-5 pt-2 border border-secondary" style = {{marginTop: "15vh"}}
                onSubmit={handleSubmit}>
                <h1 className = "font-monospace text-center">
                    Login
                </h1>
                
                {/*Error display */}
                {error && (
                <Alert 
                    variant="danger" onClose={() => setError('')} dismissible>
                        {error}
                </Alert>)}

                {/*Username block*/}
                <Form.Group className="mb-4"
                controlId="formUsername">
                    {/*<Form.Label className = "font-monospace fs-4"></Form.Label>*/}
                    <Form.Control 
                        type="text"
                        placeholder = "Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}>
                    </Form.Control>
                </Form.Group>

                {/*Password block*/}
                <Form.Group className = "mb-2"
                controlId ="formPassword">
                    {/*<Form.Label className = "font-monospace fs-4">Password</Form.Label>*/}
                    <Form.Control 
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder = "Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}>
                    </Form.Control>
                </Form.Group>

                {/*Show password checkbox*/}
                <Form.Group className="mb-4"
                controlId = "showPasswordCheckBox">
                    <Form.Check
                        className = "font-monospace fs-5" 
                        type="checkbox"
                        label="Show Password"
                        checked={showPassword}
                        onChange={() => setShowPassword((prev) => !prev)} /> 
                </Form.Group>

                {/*Login button*/}
                <div className="d-grid">
                    <Button
                        className = "font-monospace fs-4"
                        variant="secondary" 
                        type="submit"
                        size="lg"
                        disabled={isLoading}>
                        {isLoading ? 'Logging in...' : 'Start'}
                    </Button>

                </div>

                {/*Link to registration page*/}
                <div className="text-center mt-2 lh-sm">
                    <span className="font-monospace fs-5">Don't have an account? </span>
                    <br />
                    <Link to="/register" className="font-monospace fs-5">Sign up here</Link>
                </div>
            </Form>
            </div>        
        </Container>
    );
}
export default LoginPage;
