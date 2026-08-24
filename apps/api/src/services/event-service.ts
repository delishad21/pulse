import { getRepository } from "../repositories/registry.js";
import type { TaskEvent, UserId } from "@pulse/domain";
export const listActivity=(u:UserId):Promise<TaskEvent[]>=>getRepository().events.list(u);
export const listTaskHistory=(u:UserId,t:string):Promise<TaskEvent[]>=>getRepository().events.list(u,t);
export const recordEvent=(u:UserId,t:string,k:string,p?:unknown):Promise<TaskEvent>=>getRepository().events.record(u,t,k,p);
