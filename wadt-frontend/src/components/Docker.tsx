import { useState, useEffect } from 'react';
import Button from 'react-bootstrap/Button';



/*
const fetchContainerName = await fetch('<int:container_id>/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
});

const fetchContainerStart = await fetch('containers/start/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },

    body: JSON.stringify({}),
})

const fetchContainerStop = await fetch('containers/<str:container_id>/stop/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
})

const fetchContainerRestart = await fetch('containers/<str:container_id>/restart/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
})


const container_name = await fetchContainerName.json();
const container_start = await fetchContainerStart.json();
const container_stop = await fetchContainerStop.json();
const container_restart = await fetchContainerRestart.json();


*/
/**
 * Checklist
 *  - Fetch containers from backend
 * - Display container names as well as start, stop, and restart buttons
 * - implement start stop and restart
 * 
 */

// 1) Fetch containers from backend

// I need to make an interface for the container data

interface DockerContainer {
    id: string; 
    name: string;
    image: string;
    status: string;
};


function Docker() {
    return (
        <p style={{fontSize: '20px', marginTop: '100px'}}>
            This is the docker container 
            <Button variant="primary">Start</Button>
            <Button variant="primary">Stop</Button> 
            <Button variant="primary">Restart</Button>
            <br/>
        </p>
    )
    
}

export default Docker;


/* 
Original Code

 
*/



/*
    const [containers, setContainers] = useState<DockerContainer[]>([]);

    useEffect(() => {
        // add base url to axios
        const fetchContainers = async () =>{
        const res = await fetch('containers/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        
        const data = await res.json();
        setContainers(data);

        }

        fetchContainers();
    }, []);


    return (
        <ul>
            {containers.map(container => (
                <li key={container.id}>
                    {container.name} - {container.status}
                    <Button variant="success" className="mx-2">Start</Button>
                    <Button variant="warning" className="mx-2">Stop</Button>
                    <Button variant="danger" className="mx-2">Restart</Button>
                </li>
            ))}
        </ul>
    )
   */