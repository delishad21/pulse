import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateProjectInput, CreateSectionInput, UpdateProjectInput, UpdateSectionInput } from "@pulse/api-client";

const projectsKey = "projects";

export function useProjects() {
  return useQuery({ queryKey: [projectsKey], queryFn: () => apiClient.listProjects() });
}

export function useSections(projectId?: string | null) {
  return useQuery({
    queryKey: [projectsKey, projectId, "sections"],
    queryFn: () => apiClient.listSections(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => apiClient.createProject(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [projectsKey] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) => apiClient.updateProject(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [projectsKey] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteProject(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [projectsKey] }),
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSectionInput) => apiClient.createSection(input),
    onSuccess: (_data, input) => void queryClient.invalidateQueries({ queryKey: [projectsKey, input.projectId, "sections"] }),
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, id, input }: { projectId: string; id: string; input: UpdateSectionInput }) => apiClient.updateSection(projectId, id, input),
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: [projectsKey, variables.projectId, "sections"] }),
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => apiClient.deleteSection(projectId, id),
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: [projectsKey, variables.projectId, "sections"] }),
  });
}
