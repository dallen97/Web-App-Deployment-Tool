import { Container } from 'react-bootstrap';
import {useState } from "react";
// import { Link } from 'react-router-dom'; // Need this for Header links
import {Form, Button} from "react-bootstrap"

// TODO: 
    // Connect endpoints
    // Make not look like buns
    // Make start button actually do something

function LoginPage(){
    const [showPassword, setShowPassword] = useState(false); // Show or not show password

    return(
        <Container>
            {/*Title block, might make subtitle later if we get a real app name*/}         
            <h1 className="display-4 font-monospace text-center">
                Sign in to your account
            </h1>
            <div className= "d-flex justify-content-center align-items-center">

            <Form className = "loginForm rounded p-4 border border-secondary">
                {/*Username block*/}
                <Form.Group className="mb-3"
                controlId="formUsername">
                    <Form.Label className = "font-monospace fs-4">Username</Form.Label>
                    <Form.Control 
                        type="text"
                        placeholder = "Enter Username">
                    </Form.Control>
                </Form.Group>

                {/*Password block*/}
                <Form.Group className = "mb-3"
                controlId ="formPassword">
                    <Form.Label className = "font-monospace fs-4">Password</Form.Label>
                    <Form.Control 
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder = "Enter Password">
                    </Form.Control>
                </Form.Group>

                {/*Show password checkbox*/}
                <Form.Group className="mb-3"
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
            </Form>
            </div>        
        </Container>
    );
}
export default LoginPage;
