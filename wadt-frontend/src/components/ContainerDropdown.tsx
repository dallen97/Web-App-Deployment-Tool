import { Dropdown } from 'react-bootstrap';

interface ContainerDropdownProps {
  runningContainers: string[]; // list of all running containers
  currentContainer: string | null;
  setCurrentContainer: (container: string) => void; // update state on logpage
}

function ContainerDropdown({runningContainers, currentContainer, setCurrentContainer}: ContainerDropdownProps) {

  // Drowpdown for button
  function renderDropdown() {
    // No containers running
    if (runningContainers.length === 0) 
    {
      return (
        <Dropdown.Item disabled>
          No containers running
        </Dropdown.Item>
      );
    }
    // Show  currently running containers
    return runningContainers.map((container: string, index: number) => (
      <Dropdown.Item
        key={index}
        onClick={() => setCurrentContainer(container)}> {container}
      </Dropdown.Item>
    ));
  }

  return (
    // Button
    <Dropdown>
      <Dropdown.Toggle variant="success" size="lg">
        {currentContainer || "No Containers Running"}
      </Dropdown.Toggle>

      <Dropdown.Menu>
        {renderDropdown()}
      </Dropdown.Menu>
    </Dropdown>
  );
}
export default ContainerDropdown;
