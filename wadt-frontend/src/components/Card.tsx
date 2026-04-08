import Card from "react-bootstrap/Card";
import type { ReactNode } from "react";

// Need to allow for any props to be passed in

export interface CardsProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  text?: ReactNode;
  header?: ReactNode;
  cardWidth?: number | string;
  cardMargin?: number | string;
  cardHeight?: number | string;
}

const Cards: React.FC<CardsProps> = ({
  title,
  subtitle,
  text,
  header,
  cardWidth,
  cardHeight,
}) => {
  return (
    <>
      {["Light"].map((variant) => (
        <Card
          border="light"
          style={{
            width: cardWidth,
            margin: "0 auto",
            height: cardHeight ?? "500px",
          }}
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
          <Card.Body className="containers_card">
            <Card.Header
              className="card_header d-flex justify-content-center align-center"
              style={{ background: "transparent", border: "none" }}
            >
              {header}
            </Card.Header>
            <Card.Title style={{ textAlign: "center" }}>
              <h4>{title}</h4>
            </Card.Title>
            <Card.Subtitle className="mb-2 text-muted">
              {subtitle}
            </Card.Subtitle>
            <Card.Text className="small_text" style={{ textAlign: "center" }}>
              <strong>{text}</strong>
            </Card.Text>
          </Card.Body>
        </Card>
      ))}
    </>
  );
};

export default Cards;
