import Docker from '../components/Docker';
import Header from '../components/Header';

const HeaderComponent = Header as unknown as React.ComponentType<any>;

function DashboardPage()
{
    return (
        <div>
            <HeaderComponent 
            buttons={[
                {text: "Home", link: "/"},
                {text: "Sign in", link: "/login"},
                {text: "Account", link: "/account"},
            ]}
            />
            <Docker 
            docker={[
                {name: "Docker1", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Docker2", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Docker3", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Docker4", startlink: "/", stoplink: "/", restartlink: "/"},

            ]}
            />
        </div>
    )
}


export default DashboardPage;