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

const Docker = ( {docker = []}:DockerList) =>{
    return (
        <>
            <div style={{fontSize: '20px', marginTop: '100px'}}>
                {docker.map((d, i) => (
                    <div key={i} style={{marginTop:'50px'}}>
                        {d.name} container
                        <Button variant="primary" href={d.startlink}>Start</Button>
                        <Button variant="primary" href={d.stoplink}>Stop</Button>
                        <Button variant="primary" href={d.restartlink}>Restart</Button>
                    </div>
                ))}
            </div>
            
        </>
    )
};

export default Docker;
