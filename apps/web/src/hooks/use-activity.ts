import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: ["task-history", taskId],
    queryFn: () => apiClient.getTaskHistory(taskId),
    enabled: Boolean(taskId),
  });
}

export function useActivity() {
  return useQuery({ queryKey: ["activity"], queryFn: () => apiClient.listActivity() });
}
