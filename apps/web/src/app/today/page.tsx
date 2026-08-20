import { Dashboard } from "@/components/dashboard";

export default function TodayPage() {
  return <Dashboard title="Today" filter={{ type: "today" }} />;
}
