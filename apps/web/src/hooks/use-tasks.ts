import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const tasksKey = "tasks";

export function useTasks(query?: { projectId?: string; sectionId?: string; status?: "open" | "completed" | "cancelled" }) {
  return useQuery({ queryKey: [tasksKey, query], queryFn: () => apiClient.listTasks(query) });
}

function invalidateTasks(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [tasksKey] });
  void queryClient.invalidateQueries({ queryKey: ["history"] });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: apiClient.createTask.bind(apiClient), onSuccess: () => invalidateTasks(queryClient) });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof apiClient.updateTask>[1] }) => apiClient.updateTask(id, input), onSuccess: () => invalidateTasks(queryClient) });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.completeTask(id), onSuccess: () => invalidateTasks(queryClient) });
}

export function useReopenTask() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.reopenTask(id), onSuccess: () => invalidateTasks(queryClient) });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.deleteTask(id), onSuccess: () => invalidateTasks(queryClient) });
}

export function useBulkTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "complete" | "delete" }) => {
      if (action === "complete") return apiClient.bulkComplete({ ids });
      await apiClient.bulkDelete({ ids });
      return [];
    },
    onSuccess: () => invalidateTasks(queryClient),
  });
}

export function useTask(id: string) {
  return useQuery({ queryKey: [tasksKey, id], queryFn: () => apiClient.getTask(id), enabled: Boolean(id) });
}
