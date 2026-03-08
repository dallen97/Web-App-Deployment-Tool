import Card from "react-bootstrap/Card";
import type { ReactNode } from "react";

// Need to allow for any props to be passed in

export interface CardsProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  text?: ReactNode;
  cardWidth?: number | string;
  cardMargin?: number | string;
}

const Cards: React.FC<CardsProps> = ({ title, subtitle, text, cardWidth }) => {
  return (
    <>
      {["Light"].map((variant) => (
        <Card
          border="light"
          style={{ width: cardWidth, margin: "0 auto", minHeight: "500px" }}
          bg={
            variant.toLowerCase() as
              | "light"
              | "dark"
              | "primary"
              | "secondary"
              | "success"
              | "warning"
              | "danger"
              | "info"
              | "white"
              | "transparent"
          }
          key={variant}
          text={variant.toLowerCase() === "light" ? "dark" : "white"}
          className="mb-2"
        >
          <Card.Body style={{border: "1px solid rgb(255, 255, 255)", borderRadius: "15px"}}>
            <Card.Title style={{textAlign: "center"}}>
              <h4>
                {title}  
              </h4>
            </Card.Title>
            <Card.Subtitle className="mb-2 text-muted">
              {subtitle}
            </Card.Subtitle>
            <Card.Text style={{fontSize: "1.25rem", textAlign: "center", marginTop: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "150px" }}>
              <strong>
                {text}
              </strong>
            </Card.Text>
          </Card.Body>
        </Card>
      ))}
    </>
  );
};

export default Cards;
