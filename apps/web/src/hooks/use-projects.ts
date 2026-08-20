import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const projectsKey = "projects";
export function useProjects() { return useQuery({ queryKey: [projectsKey], queryFn: () => apiClient.listProjects() }); }
export function useSections(projectId?: string | null) { return useQuery({ queryKey: [projectsKey, projectId, "sections"], queryFn: () => apiClient.listSections(projectId!), enabled: Boolean(projectId) }); }
export function useCreateProject() { const q=useQueryClient(); return useMutation({ mutationFn: apiClient.createProject.bind(apiClient), onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]}) }); }
export function useUpdateProject() { const q=useQueryClient(); return useMutation({ mutationFn:({id,input}:{id:string;input:Parameters<typeof apiClient.updateProject>[1]})=>apiClient.updateProject(id,input), onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]}) }); }
export function useDeleteProject() { const q=useQueryClient(); return useMutation({ mutationFn:(id:string)=>apiClient.deleteProject(id), onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]}) }); }
