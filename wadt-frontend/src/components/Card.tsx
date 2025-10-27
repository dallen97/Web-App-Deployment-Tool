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
          style={{ width: cardWidth, margin: "0 auto" }}
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
          <Card.Body>
            <Card.Title>{title}</Card.Title>
            <Card.Subtitle className="mb-2 text-muted">
              {subtitle}
            </Card.Subtitle>
            <Card.Text>{text}</Card.Text>
          </Card.Body>
        </Card>
      ))}
    </>
  );
};

export default Cards;
