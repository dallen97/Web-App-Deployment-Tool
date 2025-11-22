import { Container } from 'react-bootstrap';
import {useState } from "react";
import { Link } from 'react-router-dom'; // Need this for Header links
import {Form, Button} from "react-bootstrap"

// TODO: 
    // Connect endpoints
    // Add background image/scene so it doesnt look like the void
    // Make start button actually do something

function LoginPage(){
    const [showPassword, setShowPassword] = useState(false); // Show or not show password

    return(
        <Container>
            {/*Title block, might make subtitle later if we get a real app name        
            <h1 className="display-4 font-monospace text-center" style = {{marginTop: "15vh"}}>
                Sign in to your account
            </h1>
            */}
            <div className= "d-flex justify-content-center align-items-center">

            <Form className = "loginForm rounded-3 p-5 pt-2 border border-secondary" style = {{marginTop: "15vh"}}>
                <h1 className = "font-monospace text-center">
                    Login
                </h1>
                {/*Username block*/}
                <Form.Group className="mb-4"
                controlId="formUsername">
                    {/*<Form.Label className = "font-monospace fs-4"></Form.Label>*/}
                    <Form.Control 
                        type="text"
                        placeholder = "Username">
                    </Form.Control>
                </Form.Group>

                {/*Password block*/}
                <Form.Group className = "mb-2"
                controlId ="formPassword">
                    {/*<Form.Label className = "font-monospace fs-4">Password</Form.Label>*/}
                    <Form.Control 
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder = "Password">
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
                        size="lg">
                        Start
                    </Button>

                </div>

                {/*Link to login page*/}
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
