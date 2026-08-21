import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const tasksKey = "tasks";

export function useTasks(query?: { projectId?: string; sectionId?: string; status?: "open" | "completed" | "cancelled" }, enabled = true) {
  return useQuery({ queryKey: [tasksKey, query], queryFn: () => apiClient.listTasks(query), enabled });
}

export type CanonicalTaskView = "inbox" | "today" | "upcoming" | "completed";

export function useTaskView(view: CanonicalTaskView, enabled = true) {
  return useQuery({
    queryKey: [tasksKey, "view", view],
    enabled,
    queryFn: () => {
      if (view === "inbox") return apiClient.getInbox();
      if (view === "today") return apiClient.getToday();
      if (view === "upcoming") return apiClient.getUpcoming();
      return apiClient.getCompleted();
    },
  });
}

export function useTaskSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [tasksKey, "search", trimmed],
    queryFn: () => apiClient.searchTasks(trimmed),
    enabled: trimmed.length > 0,
  });
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

export function useBulkMoveTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, projectId, sectionId }: { ids: string[]; projectId: string | null; sectionId?: string | null }) =>
      apiClient.bulkMove({ ids, projectId, sectionId }),
    onSuccess: () => invalidateTasks(queryClient),
  });
}

export function useBulkRescheduleTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, dueDate }: { ids: string[]; dueDate: string | null }) =>
      apiClient.bulkReschedule({ ids, dueDate, dueAt: null }),
    onSuccess: () => invalidateTasks(queryClient),
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; sortOrder: number }>) =>
      apiClient.bulkReorder({ updates }),
    onSuccess: () => invalidateTasks(queryClient),
  });
}

export function useTask(id: string) {
  return useQuery({ queryKey: [tasksKey, id], queryFn: () => apiClient.getTask(id), enabled: Boolean(id) });
}
