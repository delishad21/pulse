import { formatDateInTimezone, nextRecurrenceDate, nextRecurrenceInstant, recurrenceRuleForNextOccurrence, type Task, type UserId } from "@pulse/domain";
import type { BulkUpdateInput, CreateTaskInput, UpdateTaskInput } from "@pulse/api-client";
import { getRepository } from "../repositories/registry.js";

export interface CompletionResult { task: Task; spawnedTask: Task | null; }
export interface BulkCompletionResult { tasks: Task[]; spawnedTasks: Task[]; }

export const listTasks = (userId: UserId, filters: Record<string,string> = {}) => getRepository().tasks.list(userId,{status:filters.status as "open"|"completed"|"cancelled"|undefined,projectId:filters.projectId});
export const createTask = (userId:UserId,input:CreateTaskInput):Promise<Task> => getRepository().tasks.create(userId,input);
export const getTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.get(userId,id);
export const updateTask = (userId:UserId,id:string,input:UpdateTaskInput):Promise<Task> => getRepository().tasks.update(userId,id,input);
export const deleteTask = (userId:UserId,id:string):Promise<void> => getRepository().tasks.delete(userId,id);
export const reopenTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.reopen(userId,id);
export const cancelTask = (userId:UserId,id:string):Promise<Task> => getRepository().tasks.cancel(userId,id);
export const bulkDelete = (userId:UserId,ids:string[]):Promise<void> => getRepository().tasks.bulkDelete(userId,ids);
export const bulkUpdate = (userId:UserId,input:BulkUpdateInput):Promise<Task[]> => getRepository().tasks.bulkUpdate(userId,input);
export const searchTasks = (userId:UserId,q:string):Promise<Task[]> => getRepository().tasks.search(userId,q);

function shiftInstant(value: string | null, deltaMs: number): string | null {
  return value ? new Date(new Date(value).getTime()+deltaMs).toISOString() : null;
}
function shiftDate(value: string | null, deltaDays: number): string | null {
  if(!value)return null; const d=new Date(`${value}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+deltaDays); return d.toISOString().slice(0,10);
}
function dayDelta(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime()-new Date(`${from}T00:00:00Z`).getTime())/86_400_000);
}
function nextInput(task: Task, completedAt: Date, timezone: string): CreateTaskInput | null {
  if (!task.recurrenceRule) return null;
  const nextRule = recurrenceRuleForNextOccurrence(task.recurrenceRule);
  if (nextRule === null) return null;
  let startAt = task.startAt, endAt = task.endAt, dueDate = task.due.date, dueAt = task.due.at;
  let deltaMs = 0;
  if (task.startAt) {
    const next = nextRecurrenceInstant(task.startAt, task.recurrenceRule, completedAt); if(!next)return null;
    deltaMs = new Date(next).getTime()-new Date(task.startAt).getTime();
    startAt=next; endAt=shiftInstant(task.endAt,deltaMs); dueAt=shiftInstant(task.due.at,deltaMs);
    if(task.due.date) dueDate=shiftDate(task.due.date,Math.round(deltaMs/86_400_000));
  } else if (task.due.at) {
    const next = nextRecurrenceInstant(task.due.at, task.recurrenceRule, completedAt); if(!next)return null;
    deltaMs = new Date(next).getTime()-new Date(task.due.at).getTime(); dueAt=next;
  } else if (task.due.date) {
    const next = nextRecurrenceDate(task.due.date, task.recurrenceRule, formatDateInTimezone(completedAt, timezone)); if(!next)return null;
    const days=dayDelta(task.due.date,next); deltaMs=days*86_400_000; dueDate=next;
  } else {
    const anchor=completedAt.toISOString(); const next=nextRecurrenceInstant(anchor,task.recurrenceRule,completedAt); if(!next)return null;
    deltaMs=new Date(next).getTime()-completedAt.getTime(); startAt=next;
  }
  return {
    title:task.title, description:task.description, priority:task.priority, startAt, endAt, dueDate, dueAt,
    recurrenceRule:nextRule, projectId:task.projectId, parentTaskId:task.parentTaskId, sortOrder:task.sortOrder,
    tagIds:task.tags.map((tag)=>tag.id),
    reminders:task.reminders.map((r)=>({remindAt:shiftInstant(r.remindAt,deltaMs)!,channel:r.channel})),
  };
}

export async function completeTask(userId:UserId,id:string,timezone:string,completedAt=new Date()):Promise<CompletionResult>{
  const original=await getRepository().tasks.get(userId,id);
  const task=await getRepository().tasks.complete(userId,id,completedAt);
  const input=nextInput(original,completedAt,timezone);
  const spawnedTask=input?await getRepository().tasks.create(userId,input):null;
  return {task,spawnedTask};
}
export async function bulkComplete(userId:UserId,ids:string[],timezone:string,completedAt=new Date()):Promise<BulkCompletionResult>{
  const originals=await Promise.all(ids.map((id)=>getRepository().tasks.get(userId,id)));
  const tasks=await getRepository().tasks.bulkComplete(userId,ids,completedAt);
  const spawnedTasks:Task[]=[];
  for(const original of originals){ const input=nextInput(original,completedAt,timezone); if(input)spawnedTasks.push(await getRepository().tasks.create(userId,input)); }
  return {tasks,spawnedTasks};
}
