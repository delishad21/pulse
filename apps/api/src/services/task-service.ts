import { getRepository } from "../repositories/registry.js";
import type { Task, UserId } from "@pulse/domain";
import type { BulkUpdateInput, CreateTaskInput, UpdateTaskInput } from "@pulse/api-client";

export const listTasks = (userId: UserId, filters: Record<string,string> = {}) => getRepository().tasks.list(userId,{status:filters.status as "open"|"completed"|"cancelled"|undefined,projectId:filters.projectId,sectionId:filters.sectionId});
export const createTask = (userId:UserId,input:CreateTaskInput):Promise<Task> => getRepository().tasks.create(userId,input);
export const getTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.get(userId,id);
export const updateTask = (userId:UserId,id:string,input:UpdateTaskInput):Promise<Task> => getRepository().tasks.update(userId,id,input);
export const deleteTask = (userId:UserId,id:string):Promise<void> => getRepository().tasks.delete(userId,id);
export const completeTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.complete(userId,id);
export const reopenTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.reopen(userId,id);
export const cancelTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.cancel(userId,id);
export const bulkComplete = (userId:UserId,ids:string[]):Promise<Task[]> => getRepository().tasks.bulkComplete(userId,ids);
export const bulkDelete = (userId:UserId,ids:string[]):Promise<void> => getRepository().tasks.bulkDelete(userId,ids);
export const bulkUpdate = (userId:UserId,input:BulkUpdateInput):Promise<Task[]> => getRepository().tasks.bulkUpdate(userId,input);
export const searchTasks = (userId:UserId,q:string):Promise<Task[]> => getRepository().tasks.search(userId,q);
