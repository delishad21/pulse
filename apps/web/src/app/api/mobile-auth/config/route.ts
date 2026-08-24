import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    authDisabled: process.env.PULSE_AUTH_DISABLED === "true",
    registrationEnabled: process.env.PULSE_REGISTRATION_ENABLED === "true",
  });
}
