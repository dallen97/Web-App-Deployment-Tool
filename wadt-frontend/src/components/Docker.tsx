import Button from 'react-bootstrap/Button';
import Header from '../components/Header';


function Docker() {
    return (
        <Header />
        <p style={{fontSize: '20px', marginTop: '100px'}}>
            This is the docker container <Button variant="primary">Start</Button><Button variant="primary">Stop</Button> <br/>
            This is the docker container <Button variant="primary">Start</Button><Button variant="primary">Stop</Button> <br/>
            This is the docker container <Button variant="primary">Start</Button><Button variant="primary">Stop</Button> <br/>
            This is the docker container <Button variant="primary">Start</Button><Button variant="primary">Stop</Button> <br/>
            This is the docker container <Button variant="primary">Start</Button><Button variant="primary">Stop</Button> <br/>
        </p>
    )
}

export default Docker;