import { Dashboard } from "@/components/dashboard";

export default function UpcomingPage() {
  return <Dashboard title="Upcoming" filter={{ type: "upcoming" }} />;
}
