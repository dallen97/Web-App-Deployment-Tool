import Button from 'react-bootstrap/Button';

export interface DockerProps{
    name: string;
    startlink: string;
    stoplink: string;
    restartlink: string;
};

export interface DockerList{
    docker?: DockerProps[];
};

const handleSubmit = async function hadleSelect(){
    fetch('wadtapp/containers/start/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        imageName: 'pygoat/pygoat'
        // this is the image name, change it out for other images as needed
        /* other image names
        
        bkimminich/juice-shop
        grafana/grafana:8.3.0
        pygoat/pygoat
        */
    })
})
    .then(response => response.json())
    .then(data => console.log('Success:', data))
    .catch(error => console.error('Error:', error));
    }

const Docker = ( {docker = []}:DockerList) =>{
    return (
        <>
            <div style={{fontSize: '20px', marginTop: '100px'}}>
                {docker.map((d, i) => (
                    <div key={i} style={{marginTop:'50px'}}>
                        {d.name} container
                        <Button variant="primary" onClick={handleSubmit}>Start</Button>
                        <Button variant="primary" href={d.stoplink}>Stop</Button>
                        <Button variant="primary" href={d.restartlink}>Restart</Button>
                    </div>
                ))}
            </div>
            
        </>
    )
};

export default Docker;
