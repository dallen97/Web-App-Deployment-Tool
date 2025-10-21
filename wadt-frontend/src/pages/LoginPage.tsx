import { Container } from 'react-bootstrap';
import Header from "../components/Header";
import { Link } from 'react-router-dom'; // Need this for Header links

function LoginPage(){
    return(
        <Container>
            <Header/>
            
            <header>
                Temporarily testing Routing with new Page
            </header>

            <Link to="/">
            Go back to LandingPage
            </Link>

        </Container>
    );
}
export default LoginPage;