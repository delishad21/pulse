import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const tagsKey = "tags";

export function useTags() {
  return useQuery({ queryKey: [tagsKey], queryFn: () => apiClient.listTags() });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createTag.bind(apiClient),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [tagsKey] }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTag(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tagsKey] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
