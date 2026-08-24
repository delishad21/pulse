import { redirect } from "next/navigation";
import { RegisterClient } from "./register-client";

export default function RegisterPage() {
  if (process.env.PULSE_REGISTRATION_ENABLED !== "true") redirect("/login");
  return <RegisterClient />;
}
