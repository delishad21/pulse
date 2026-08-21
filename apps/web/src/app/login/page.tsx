import { LoginClient } from "./login-client";

export default function LoginPage() {
  return <LoginClient registrationEnabled={process.env.PULSE_REGISTRATION_ENABLED === "true"} />;
}
