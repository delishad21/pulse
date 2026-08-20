import { getRepository } from "../repositories/registry.js";
import type { Operation, UserId } from "@pulse/domain";
import type { TaskSnapshot } from "../repositories/types.js";

export const recordOperation = (userId:UserId,kind:string,payload:unknown,taskId?:string):Promise<Operation> => getRepository().operations.record(userId,kind,payload,taskId);
export const listOperations = (userId:UserId):Promise<Operation[]> => getRepository().operations.list(userId);
export const undoLast = (userId:UserId):Promise<Operation> => getRepository().operations.undoLast(userId);
export const undoOperation = (userId:UserId,id:string):Promise<Operation> => getRepository().operations.undo(userId,id);
export const captureSnapshot = (userId:UserId,taskId:string):Promise<TaskSnapshot> => getRepository().tasks.captureSnapshot(userId,taskId);
export const captureSnapshots = (userId:UserId,ids:string[]):Promise<TaskSnapshot[]> => Promise.all(ids.map((id)=>getRepository().tasks.captureSnapshot(userId,id)));
