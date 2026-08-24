import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateProjectInput, UpdateProjectInput } from "@pulse/api-client";
const projectsKey="projects";
export function useProjects(){return useQuery({queryKey:[projectsKey],queryFn:()=>apiClient.listProjects()});}
export function useCreateProject(){const q=useQueryClient();return useMutation({mutationFn:(input:CreateProjectInput)=>apiClient.createProject(input),onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]})});}
export function useUpdateProject(){const q=useQueryClient();return useMutation({mutationFn:({id,input}:{id:string;input:UpdateProjectInput})=>apiClient.updateProject(id,input),onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]})});}
export function useDeleteProject(){const q=useQueryClient();return useMutation({mutationFn:(id:string)=>apiClient.deleteProject(id),onSuccess:()=>void q.invalidateQueries({queryKey:[projectsKey]})});}
