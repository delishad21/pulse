import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
const tasksKey="tasks";
export function useTasks(query?:{projectId?:string;status?:"open"|"completed"|"cancelled"},enabled=true){return useQuery({queryKey:[tasksKey,query],queryFn:()=>apiClient.listTasks(query),enabled});}
export type CanonicalTaskView="inbox"|"today"|"upcoming"|"completed";
export function useTaskView(view:CanonicalTaskView,enabled=true,includeCompleted=false){return useQuery({queryKey:[tasksKey,"view",view,includeCompleted],enabled,queryFn:()=>view==="inbox"?apiClient.getInbox(includeCompleted):view==="today"?apiClient.getToday(includeCompleted):view==="upcoming"?apiClient.getUpcoming(includeCompleted):apiClient.getCompleted()});}
function invalidateTasks(q:ReturnType<typeof useQueryClient>){void q.invalidateQueries({queryKey:[tasksKey]});void q.invalidateQueries({queryKey:["history"]});void q.invalidateQueries({queryKey:["reminders"]});}
export function useCreateTask(){const q=useQueryClient();return useMutation({mutationFn:apiClient.createTask.bind(apiClient),onSuccess:()=>invalidateTasks(q)});}
export function useUpdateTask(){const q=useQueryClient();return useMutation({mutationFn:({id,input}:{id:string;input:Parameters<typeof apiClient.updateTask>[1]})=>apiClient.updateTask(id,input),onSuccess:()=>invalidateTasks(q)});}
export function useCompleteTask(){const q=useQueryClient();return useMutation({mutationFn:(id:string)=>apiClient.completeTask(id),onSuccess:()=>invalidateTasks(q)});}
export function useReopenTask(){const q=useQueryClient();return useMutation({mutationFn:(id:string)=>apiClient.reopenTask(id),onSuccess:()=>invalidateTasks(q)});}
export function useDeleteTask(){const q=useQueryClient();return useMutation({mutationFn:(id:string)=>apiClient.deleteTask(id),onSuccess:()=>invalidateTasks(q)});}
export function useBulkTasks(){const q=useQueryClient();return useMutation({mutationFn:async({ids,action}:{ids:string[];action:"complete"|"delete"})=>{if(action==="complete")return apiClient.bulkComplete({ids});await apiClient.bulkDelete({ids});return[];},onSuccess:()=>invalidateTasks(q)});}
export function useBulkMoveTasks(){const q=useQueryClient();return useMutation({mutationFn:({ids,projectId}:{ids:string[];projectId:string|null})=>apiClient.bulkMove({ids,projectId}),onSuccess:()=>invalidateTasks(q)});}
export function useBulkRescheduleTasks(){const q=useQueryClient();return useMutation({mutationFn:({ids,dueDate}:{ids:string[];dueDate:string|null})=>apiClient.bulkReschedule({ids,dueDate,dueAt:null}),onSuccess:()=>invalidateTasks(q)});}
export function useReorderTasks(){const q=useQueryClient();return useMutation({mutationFn:(updates:Array<{id:string;sortOrder:number}>)=>apiClient.bulkReorder({updates}),onSuccess:()=>invalidateTasks(q)});}
export function useTask(id:string){return useQuery({queryKey:[tasksKey,id],queryFn:()=>apiClient.getTask(id),enabled:Boolean(id)});}
