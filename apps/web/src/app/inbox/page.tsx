import { Dashboard } from "@/components/dashboard";

export default function InboxPage() {
  return <Dashboard title="Inbox" filter={{ type: "inbox" }} />;
}
