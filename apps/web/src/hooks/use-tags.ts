import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const tagsKey = "tags";

export function useTags() {
  return useQuery({ queryKey: [tagsKey], queryFn: () => apiClient.listTags() });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: apiClient.createTag.bind(apiClient), onSuccess: () => void queryClient.invalidateQueries({ queryKey: [tagsKey] }) });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: { name?: string; color?: string | null } }) => apiClient.updateTag(id, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: [tagsKey] }); void queryClient.invalidateQueries({ queryKey: ["tasks"] }); } });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.deleteTag(id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: [tagsKey] }); void queryClient.invalidateQueries({ queryKey: ["tasks"] }); } });
}
