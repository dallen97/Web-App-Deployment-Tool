import ContainerDropdown from "../components/ContainerDropdown";
import {Card} from 'react-bootstrap';
import {useState, useEffect} from 'react';

/* TODO: 
    Make cards
    
    */
// track running containers
interface ContainerInfo 
{
    id: string;
    name: string;
}

function LogPage(){

    // states
    const [runningContainers, setRunningContainers] = useState<ContainerInfo[]>([]);
    const [currentContainer, setCurrentContainer] = useState<ContainerInfo | null>(null);
    const [logs, setLogs] = useState<{timestamp: string; message: string}[]> ([]);

    // Get list of running containers when opening page
    useEffect(() => {
        fetch("wadtapp/get_containers/", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const containers = data.map((c: ContainerInfo) => ({
            id: c.id,
            name: c.name,}));
            setRunningContainers(containers);
            setCurrentContainer(containers[0] ?? null);
        })
        .catch(err => console.error("Failed to fetch containers:", err));
    }, []);

    // update logs when current container changes
    useEffect(() => {
        if (!currentContainer) // no containers running
            return;
        // containers are running
        fetch('api/get_container_logs/${currentContainer.id}/', {credentials: "include"})
            .then(res => res.json())
            .then(data => setLogs(data.logs))
            .catch(err => console.error("Failed to fetch containers:", err));
  }, [currentContainer]);

    return (
    // Top card with Title and dropdown button*
    <>
    <Card>
        <Card.Body
            style = {{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
            {/* Page title*/}
            <Card.Title 
                style = {{
                fontSize: "3rem"
                }}>
                Container Logs
            </Card.Title>
            {/*Dropdown button*/}
            <ContainerDropdown 
                runningContainers = {runningContainers.map(c => c.name)}
                currentContainer = {currentContainer?.name ?? null}
                setCurrentContainer = {(name) => {
                    const findContainer = runningContainers.find(c => c.name === name) ?? null;
                    setCurrentContainer(findContainer)}}/>
        </Card.Body>
    </Card>
    {/* Second Card with Start, Stop, Restart, Reset and Clear logs -> just adjust first card component*/}
            
    {/* Thrid Card with search bar*/}

    {/*Fourth Card with Filter for types of logs*/}

    {/* Fifth Card The actual logs */}
    </>
    );
}
export default LogPage;