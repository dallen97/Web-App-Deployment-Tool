import React from "react";

//Making the button dynamic
interface Props {
  children: string;
}

const Button = ({ children }: Props) => {
  // bootstrap dark button theme
  return (
    <button type="button" className="btn btn-light">
      {children}
    </button>
  );
};

export default Button;
