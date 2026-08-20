import { Dashboard } from "@/components/dashboard";

export default function CompletedPage() {
  return <Dashboard title="Completed" filter={{ type: "completed" }} />;
}
