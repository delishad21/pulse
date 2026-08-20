import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const historyKey = "history";

export function useHistory() {
  return useQuery({ queryKey: [historyKey], queryFn: () => apiClient.listOperations() });
}

export function useUndo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.undoLast(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [historyKey] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}
