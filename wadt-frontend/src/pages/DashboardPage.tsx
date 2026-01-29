import Docker from '../components/Docker';
import Header from '../components/Header';

const HeaderComponent = Header as unknown as React.ComponentType<any>;

function DashboardPage()
{
    return (
        <h1>
            <HeaderComponent />
            <Docker />
        </h1>
    )
}


export default DashboardPage;