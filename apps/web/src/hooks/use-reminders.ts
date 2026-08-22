import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const remindersKey = "reminders";

export function useReminders(taskId: string) {
  return useQuery({
    queryKey: [remindersKey, taskId],
    queryFn: () => apiClient.listReminders(taskId),
    enabled: Boolean(taskId),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, remindAt }: { taskId: string; remindAt: string }) =>
      apiClient.createReminder(taskId, { remindAt, channel: "hermes_telegram" }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [remindersKey, variables.taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [remindersKey, taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
