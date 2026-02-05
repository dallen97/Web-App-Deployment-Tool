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
                {name: "PyGoat", imageName: "pygoat/pygoat", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Juice Shop", imageName: "bkimminich/juice-shop", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Grafana", imageName: "grafana/grafana:8.3.0", startlink: "/", stoplink: "/", restartlink: "/"},
                {name: "Hello World", imageName: "hello-world", startlink: "/", stoplink: "/", restartlink: "/"},

            ]}
            />
        </div>
    )
}


export default DashboardPage;