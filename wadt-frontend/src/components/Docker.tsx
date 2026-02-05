import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';

export interface DockerProps{
    name: string;
    startlink: string;
    stoplink: string;
    restartlink: string;
    imageName: string; 
};

export interface DockerList{
    docker?: DockerProps[];
};

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

const Docker = ({ docker = [] }: DockerList) => {
    // State to track status: 'idle', 'loading', or 'ready' for each container by name
    const [containerStatus, setContainerStatus] = useState<{ [key: string]: 'idle' | 'loading' | 'ready' }>({});
    
    // State to store the dynamic URL (e.g., localhost:55001) once ready
    const [containerUrls, setContainerUrls] = useState<{ [key: string]: string }>({});

    // 1. Start Container
    const handleStart = async (imageName: string, containerName: string) => {
        // Immediately show spinner
        setContainerStatus(prev => ({ ...prev, [containerName]: 'loading' }));

        try {
            const response = await fetch('wadtapp/containers/start/', {
                method: 'POST',
                credentials: 'include', 
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('wadt_csrftoken') || ''
                },
                body: JSON.stringify({
                    imageName: imageName
                })
            });
            
            const data = await response.json();

            if (response.ok && data.id) {
                console.log("Container started, waiting for port...", data.id);
                // Begin polling the new endpoint to see when the port is open
                pollForReadiness(data.id, containerName);
            } else {
                console.error('Start failed:', data);
                // Reset to start button on failure
                setContainerStatus(prev => ({ ...prev, [containerName]: 'idle' }));
            }
        } catch (error) {
            console.error('Error:', error);
            setContainerStatus(prev => ({ ...prev, [containerName]: 'idle' }));
        }
    };

    // 2. Poll for Readiness (The "Health Check")
    const pollForReadiness = (containerId: string, containerName: string) => {
        const intervalId = setInterval(async () => {
            try {
                // Using the new RESTful URL structure: containers/<id>/check-ready/
                const response = await fetch(`wadtapp/containers/${containerId}/check-ready/`, {
                    method: 'POST', 
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('wadt_csrftoken') || '' 
                    }
                });

                if (response.status === 401) {
                    console.error("!!! FRONTEND 401 DETECTED !!!");
                    console.log("Timestamp:", new Date().toISOString());
                    console.log("Current Browser Cookies:", document.cookie);
                    console.log("Am I trying to send credentials? YES (include)");
                    
                    // Stop polling so we don't spam the logs
                    clearInterval(intervalId);
                    setContainerStatus(prev => ({ ...prev, [containerName]: 'idle' }));
                    return;
                }
                
                const data = await response.json();

                if (data.ready) {
                    console.log("Container is ready at:", data.url);
                    clearInterval(intervalId); // Stop checking
                    setContainerUrls(prev => ({ ...prev, [containerName]: data.url }));
                    setContainerStatus(prev => ({ ...prev, [containerName]: 'ready' }));
                }
                // If data.ready is false, the loop simply continues...
                
            } catch (error) {
                console.error("Polling error", error);
                clearInterval(intervalId); // Stop checking on network error
                setContainerStatus(prev => ({ ...prev, [containerName]: 'idle' }));
            }
        }, 2000); // Check every 2 seconds
    };

    // 3. Open in New Tab
    const handleView = (containerName: string) => {
        const url = containerUrls[containerName];
        if (url) window.open(url, '_blank');
    };

    return (
        <>
            <div style={{ fontSize: '20px', marginTop: '100px' }}>
                {docker.map((d, i) => (
                    <div key={i} style={{ marginTop: '50px' }}>
                        {d.name} container
                                                
                        {/* 1. IDLE STATE: Show Start Button */}
                        {(!containerStatus[d.name] || containerStatus[d.name] === 'idle') && (
                            <Button 
                                variant="primary" 
                                onClick={() => handleStart(d.imageName, d.name)}
                                style={{ marginLeft: '10px' }}
                            >
                                Start
                            </Button>
                        )}

                        {/* 2. LOADING STATE: Show Spinner */}
                        {containerStatus[d.name] === 'loading' && (
                            <Button variant="primary" disabled style={{ marginLeft: '10px' }}>
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                />
                                <span className="visually-hidden">Loading...</span>
                            </Button>
                        )}

                        {/* 3. READY STATE: Show Open App Button */}
                        {containerStatus[d.name] === 'ready' && (
                            <Button 
                                variant="success" 
                                onClick={() => handleView(d.name)} 
                                style={{ marginLeft: '10px' }}
                            >
                                Open App
                            </Button>
                        )}

                        {/* Standard Stop/Restart Buttons */}
                        <Button variant="danger" href={d.stoplink} style={{ marginLeft: '10px' }}>Stop</Button>
                        <Button variant="warning" href={d.restartlink} style={{ marginLeft: '10px' }}>Restart</Button>
                    </div>
                ))}
            </div>
        </>
    );
};

export default Docker;