// npm install check-password-strength
import { passwordStrength, type Options } from "check-password-strength";
import { ProgressBar } from "react-bootstrap";

function PwStrengthBar({ pwStrength }: { pwStrength: string }) {
  if (pwStrength === "Strong")
    return <ProgressBar variant="success" now={100} label="Strong" />;
  if (pwStrength === "Medium")
    return <ProgressBar variant="warning" now={60} label="Medium" />;
  if (pwStrength === "Weak")
    return <ProgressBar variant="danger" now={40} label="Weak" />;
  if (pwStrength === "Too Weak")
    return <ProgressBar variant="danger" now={25} label="Too Weak" />;
  return null;
}

const customOptions: Options<string> = [
  { id: 0, value: "Too Weak", minDiversity: 0, minLength: 0 },
  { id: 1, value: "Weak", minDiversity: 1, minLength: 5 },
  { id: 2, value: "Medium", minDiversity: 2, minLength: 7 },
  { id: 3, value: "Strong", minDiversity: 4, minLength: 10 },
];

function PasswordChecker({ password }: { password: string }) {
  const pwStrength = passwordStrength(password, customOptions).value;

  return <>{password && <PwStrengthBar pwStrength={pwStrength} />}</>;
}

export default PasswordChecker;

