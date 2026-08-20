import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const commentsKey = "comments";

export function useComments(taskId: string) {
  return useQuery({
    queryKey: [commentsKey, taskId],
    queryFn: () => apiClient.listComments(taskId),
    enabled: Boolean(taskId),
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: Parameters<typeof apiClient.createComment>[1];
    }) => apiClient.createComment(taskId, input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [commentsKey, variables.taskId],
      });
    },
  });
}
