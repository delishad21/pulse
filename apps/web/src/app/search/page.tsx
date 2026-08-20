"use client";

import { useState } from "react";
import { Dashboard } from "@/components/dashboard";

export default function SearchPage() {
  const [q, setQ] = useState("");

  return (
    <Dashboard
      title="Search"
      filter={{ type: "search", q }}
      header={
        <div className="mb-6">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      }
    />
  );
}
