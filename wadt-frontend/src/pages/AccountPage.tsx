import Header from "../components/Header";

export default function Account() {
  return (
    <>
      <Header buttons={[{ text: "Home", link: "/dashboard" }]} />
      <h1 style={{ textAlign: "center" }}>Welcome to the Account Page</h1>
    </>
  );
}
