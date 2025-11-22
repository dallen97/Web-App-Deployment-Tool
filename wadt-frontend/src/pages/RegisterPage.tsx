import { Container } from 'react-bootstrap';
import {useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom'; // Need this for Header links
import {Form, Button} from "react-bootstrap"

//TODO:
    // Add checks for username taken
    // Connect to endpoints
    // Make pretty (looks like buns)
    // Password strength checker?
    
function RegisterPage(){
    const [showPassword, setShowPassword] = useState(false) // Show or not show password
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    return(
        <Container>
            {/*Titleblock}         
            <h1 className="display-4 font-monospace text-center" style = {{marginTop: "20vh"}}>
                Get started with WADT
            </h1>*/}
            <div className= "d-flex justify-content-center align-items-center">
            {/*Title*/}
            <Form className = "loginForm rounded-3 p-5 pt-2 border border-secondary" style = {{marginTop: "15vh"}}>
                <h1 className = "font-monospace text-center">
                    Get Started with WADT
                </h1>

                {/*Fill out username block*/}
                <Form.Group className="mb-4"
                controlId="formUsername">
                    <Form.Control 
                        type="text"
                        placeholder = "Choose a Username">
                    </Form.Control>
                </Form.Group>

                {/*Create password block (first)*/}
                <Form.Group className = "mb-4"
                controlId ="formPassword">
                    <Form.Control 
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder = "Enter Password">
                    </Form.Control>
                </Form.Group>

                {/*Confirm password*/}
                <Form.Group className = "mb-2 lh-sm"
                controlId = "formConfirmPassword">
                    <Form.Control
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder = "Confirm Password">
                    </Form.Control>
                </Form.Group>

                {/*Show passwords checkbox*/}
                <Form.Group className="mb-2"
                controlId = "showPasswordCheckBox">
                    <Form.Check
                        className = "font-monospace fs-5" 
                        type="checkbox"
                        label="Show Passwords"
                        checked={showPassword}
                        onChange={() => setShowPassword((prev) => !prev)} /> 
                </Form.Group>

                {/*Sign up button*/}
                <div className="d-grid">
                    <Button
                        className = "font-monospace fs-4 "
                        variant="secondary" 
                        type="submit"
                        size="lg">
                        Create Account
                    </Button>
                </div>

                {/*Link to login page*/}
                <div className="text-center mt-2 lh-sm">
                    <span className="font-monospace fs-5">Already have an account? </span>
                    <br />
                    <Link to="/login" className="font-monospace fs-5">Click here to login</Link>
                </div>
            </Form>
            </div>        
        </Container>
    );
}
export default RegisterPage;
