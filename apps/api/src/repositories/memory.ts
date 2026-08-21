import {
  isTaskCompleted,
  isTaskDueToday,
  isTaskFocus,
  isTaskInInbox,
  isTaskOverdue,
  isTaskUpcoming,
  normalizeTaskSchedule,
  parseRecurrenceRule,
  sortTasksForView,
} from "@pulse/domain";
import { Errors } from "../lib/errors.js";
import {
  serializeComment,
  serializeOperation,
  serializeProject,
  serializeReminder,
  serializeSection,
  serializeTag,
  serializeTask,
  serializeTaskEvent,
} from "../services/task-serializer.js";
import type { PulseRepository, TaskSnapshot } from "./types.js";
import type { Task } from "@pulse/domain";

const cuid = () => `cuid_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

type TaskStatusDb = "OPEN" | "COMPLETED" | "CANCELLED";
type PriorityDb = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
interface DbTask {
  id: string; userId: string; projectId: string | null; sectionId: string | null; parentTaskId: string | null;
  title: string; description: string | null; status: TaskStatusDb; priority: PriorityDb; dueDate: Date | null; dueAt: Date | null; reminderAt: Date | null; recurrenceRule: string | null; completedAt: Date | null; deletedAt: Date | null; sortOrder: number; revision: number; createdAt: Date; updatedAt: Date; tagIds: string[];
}
interface DbProject { id: string; userId: string; name: string; description: string | null; color: string | null; icon: string | null; status: "ACTIVE" | "ARCHIVED" | "COMPLETED"; sortOrder: number; createdAt: Date; updatedAt: Date; archivedAt: Date | null; deletedAt: Date | null; }
interface DbSection { id: string; projectId: string; name: string; sortOrder: number; createdAt: Date; updatedAt: Date; deletedAt: Date | null; }
interface DbTag { id: string; userId: string; name: string; color: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null; }
interface DbComment { id: string; taskId: string; userId: string; body: string; deletedAt: Date | null; createdAt: Date; updatedAt: Date; }
interface DbReminder { id: string; taskId: string; userId: string; remindAt: Date; channel: string; status: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null; }
interface DbEvent { id: string; taskId: string; userId: string; kind: string; payload: unknown; createdAt: Date; }
interface DbOperation { id: string; userId: string; taskId: string | null; kind: string; payload: unknown; undoneAt: Date | null; createdAt: Date; sequence: number; }

function parsePriority(priority: string): PriorityDb { return priority.toUpperCase() as PriorityDb; }

export function createMemoryRepository(initialUserId?: string, additionalUserIds: string[] = []): PulseRepository {
  const users = new Map<string, { id: string }>();
  const tasks = new Map<string, DbTask>(); const projects = new Map<string, DbProject>(); const sections = new Map<string, DbSection>(); const tags = new Map<string, DbTag>();
  const comments = new Map<string, DbComment>(); const reminders = new Map<string, DbReminder>(); const events = new Map<string, DbEvent>(); const operations = new Map<string, DbOperation>(); let operationSequence = 0;
  if (initialUserId) users.set(initialUserId, { id: initialUserId });
  for (const id of additionalUserIds) users.set(id, { id });

  function ensureUser(userId: string): void { if (!users.has(userId)) throw Errors.Unauthorized(); }
  function getTask(userId: string, id: string, includeDeleted = false): DbTask { const task = tasks.get(id); if (!task || task.userId !== userId || (!includeDeleted && task.deletedAt)) throw Errors.NotFound("Task"); return task; }
  function getProject(userId: string, id: string): DbProject { const project = projects.get(id); if (!project || project.userId !== userId || project.deletedAt) throw Errors.NotFound("Project"); return project; }
  function getSection(userId: string, id: string): DbSection { const section = sections.get(id); if (!section || section.deletedAt) throw Errors.NotFound("Section"); getProject(userId, section.projectId); return section; }
  function getTag(userId: string, id: string): DbTag { const tag = tags.get(id); if (!tag || tag.userId !== userId || tag.deletedAt) throw Errors.NotFound("Tag"); return tag; }
  function getComment(userId: string, taskId: string, id: string): DbComment { getTask(userId, taskId); const comment = comments.get(id); if (!comment || comment.taskId !== taskId || comment.userId !== userId || comment.deletedAt) throw Errors.NotFound("Comment"); return comment; }
  function getReminder(userId: string, id: string): DbReminder { const reminder = reminders.get(id); if (!reminder || reminder.userId !== userId || reminder.deletedAt) throw Errors.NotFound("Reminder"); getTask(userId, reminder.taskId); return reminder; }

  function toTaskRecord(task: DbTask): Task {
    return serializeTask({ ...task, tags: task.tagIds.map((id) => tags.get(id)).filter((tag): tag is DbTag => Boolean(tag && !tag.deletedAt)).map((tag) => ({ tag })) } as never);
  }
  function taskSnapshot(task: DbTask): TaskSnapshot {
    return { taskId: task.id, before: { title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate?.toISOString() ?? null, dueAt: task.dueAt?.toISOString() ?? null, reminderAt: task.reminderAt?.toISOString() ?? null, recurrenceRule: task.recurrenceRule, projectId: task.projectId, sectionId: task.sectionId, parentTaskId: task.parentTaskId, tagIds: [...task.tagIds], completedAt: task.completedAt?.toISOString() ?? null, deletedAt: task.deletedAt?.toISOString() ?? null, sortOrder: task.sortOrder, revision: task.revision } };
  }
  function restore(task: DbTask, snapshot: TaskSnapshot): void {
    const b = snapshot.before;
    task.title = b.title as string; task.description = (b.description as string | null) ?? null; task.status = b.status as TaskStatusDb; task.priority = b.priority as PriorityDb;
    task.dueDate = b.dueDate ? new Date(b.dueDate as string) : null; task.dueAt = b.dueAt ? new Date(b.dueAt as string) : null; task.reminderAt = b.reminderAt ? new Date(b.reminderAt as string) : null;
    task.recurrenceRule = (b.recurrenceRule as string | null) ?? null; task.projectId = (b.projectId as string | null) ?? null; task.sectionId = (b.sectionId as string | null) ?? null; task.parentTaskId = (b.parentTaskId as string | null) ?? null;
    task.tagIds = [...((b.tagIds as string[]) ?? [])]; task.completedAt = b.completedAt ? new Date(b.completedAt as string) : null; task.deletedAt = b.deletedAt ? new Date(b.deletedAt as string) : null; task.sortOrder = Number(b.sortOrder ?? 0); task.revision = Number(b.revision ?? task.revision) + 1; task.updatedAt = new Date();
  }
  function validateRecurrence(value: string | null | undefined): void { if (value) parseRecurrenceRule(value); }
  async function validateRelations(userId: string, input: { projectId?: string | null; sectionId?: string | null; parentTaskId?: string | null; tagIds?: string[]; addTagIds?: string[]; removeTagIds?: string[] }, current?: DbTask): Promise<{ projectId: string | null | undefined; sectionId: string | null | undefined }> {
    let projectId = input.projectId; const sectionId = input.sectionId;
    if (projectId) getProject(userId, projectId);
    if (sectionId) {
      const section = getSection(userId, sectionId);
      const effectiveProject = projectId === undefined ? current?.projectId : projectId;
      if (effectiveProject && effectiveProject !== section.projectId) throw Errors.Validation("Section does not belong to the selected project.");
      if (!effectiveProject) projectId = section.projectId;
    }
    if (input.parentTaskId) getTask(userId, input.parentTaskId);
    const tagIds = [...(input.tagIds ?? []), ...(input.addTagIds ?? []), ...(input.removeTagIds ?? [])];
    for (const id of new Set(tagIds)) getTag(userId, id);
    return { projectId, sectionId };
  }

  const repo: PulseRepository = {
    healthCheck: async () => ({ database: "in-memory" }),
    tasks: {
      list: async (userId, filters = {}) => { ensureUser(userId); const out: Task[] = []; for (const task of tasks.values()) { if (task.userId !== userId || task.deletedAt) continue; if (filters.status && task.status !== filters.status.toUpperCase()) continue; if (filters.projectId !== undefined && task.projectId !== filters.projectId) continue; if (filters.sectionId !== undefined && task.sectionId !== filters.sectionId) continue; out.push(toTaskRecord(task)); } return out.sort((a,b) => a.sortOrder-b.sortOrder || a.createdAt.localeCompare(b.createdAt)); },
      create: async (userId, input) => { ensureUser(userId); validateRecurrence(input.recurrenceRule); const rel = await validateRelations(userId, input); const schedule = normalizeTaskSchedule(input); const task: DbTask = { id:cuid(), userId, title:input.title, description:input.description??null, status:"OPEN", priority:parsePriority(input.priority??"none"), dueDate:schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null, dueAt:schedule.due.at?new Date(schedule.due.at):null, reminderAt:schedule.reminderAt?new Date(schedule.reminderAt):null, recurrenceRule:input.recurrenceRule??null, projectId:rel.projectId??null, sectionId:rel.sectionId??null, parentTaskId:input.parentTaskId??null, completedAt:null, deletedAt:null, sortOrder:input.sortOrder??0, revision:0, createdAt:new Date(), updatedAt:new Date(), tagIds:[...(input.tagIds??[])] }; tasks.set(task.id, task); return toTaskRecord(task); },
      get: async (userId,id) => { ensureUser(userId); return toTaskRecord(getTask(userId,id)); },
      update: async (userId,id,input) => { ensureUser(userId); const task=getTask(userId,id); validateRecurrence(input.recurrenceRule); const rel=await validateRelations(userId,input,task); const schedule=normalizeTaskSchedule(input); if(input.title!==undefined)task.title=input.title; if(input.description!==undefined)task.description=input.description; if(input.priority!==undefined)task.priority=parsePriority(input.priority); if(input.dueDate!==undefined)task.dueDate=schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null; if(input.dueAt!==undefined){task.dueAt=schedule.due.at?new Date(schedule.due.at):null;if(schedule.due.at)task.dueDate=null;} if(input.reminderAt!==undefined)task.reminderAt=schedule.reminderAt?new Date(schedule.reminderAt):null; if(input.recurrenceRule!==undefined)task.recurrenceRule=input.recurrenceRule; if(rel.projectId!==undefined)task.projectId=rel.projectId; if(rel.sectionId!==undefined)task.sectionId=rel.sectionId; if(input.parentTaskId!==undefined)task.parentTaskId=input.parentTaskId; if(input.sortOrder!==undefined)task.sortOrder=input.sortOrder; if(input.tagIds!==undefined)task.tagIds=[...input.tagIds]; task.revision+=1;task.updatedAt=new Date(); return toTaskRecord(task); },
      delete: async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();},
      complete: async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.status="COMPLETED";t.completedAt=new Date();t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      reopen: async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.status="OPEN";t.completedAt=null;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      cancel: async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.status="CANCELLED";t.completedAt=null;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      bulkComplete: async(userId,ids)=>{ensureUser(userId);const out:Task[]=[];for(const id of ids){const t=getTask(userId,id);t.status="COMPLETED";t.completedAt=new Date();t.revision+=1;t.updatedAt=new Date();out.push(toTaskRecord(t));}return out;},
      bulkDelete: async(userId,ids)=>{ensureUser(userId);for(const id of ids){const t=getTask(userId,id);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();}},
      bulkUpdate: async(userId,input)=>{ensureUser(userId);validateRecurrence(input.recurrenceRule);await validateRelations(userId,input);const schedule=normalizeTaskSchedule(input);const out:Task[]=[];for(const id of input.ids){const t=getTask(userId,id);const rel=await validateRelations(userId,input,t);if(input.title!==undefined)t.title=input.title;if(input.priority!==undefined)t.priority=parsePriority(input.priority);if(input.dueDate!==undefined)t.dueDate=schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null;if(input.dueAt!==undefined){t.dueAt=schedule.due.at?new Date(schedule.due.at):null;if(schedule.due.at)t.dueDate=null;}if(input.reminderAt!==undefined)t.reminderAt=schedule.reminderAt?new Date(schedule.reminderAt):null;if(input.recurrenceRule!==undefined)t.recurrenceRule=input.recurrenceRule;if(rel.projectId!==undefined)t.projectId=rel.projectId;if(rel.sectionId!==undefined)t.sectionId=rel.sectionId;if(input.addTagIds)for(const tagId of input.addTagIds)if(!t.tagIds.includes(tagId))t.tagIds.push(tagId);if(input.removeTagIds)t.tagIds=t.tagIds.filter((x)=>!input.removeTagIds!.includes(x));t.revision+=1;t.updatedAt=new Date();out.push(toTaskRecord(t));}return out;},
      search: async(userId,query)=>{ensureUser(userId);const q=query.toLowerCase();const out:Task[]=[];for(const t of tasks.values()){if(t.userId!==userId||t.deletedAt)continue;const projectName=t.projectId?projects.get(t.projectId)?.name??"":"";const tagNames=t.tagIds.map((id)=>tags.get(id)?.name??"").join(" ");const bodies=[...comments.values()].filter((c)=>c.taskId===t.id&&!c.deletedAt).map((c)=>c.body).join(" ");if([t.title,t.description??"",projectName,tagNames,bodies].some((v)=>v.toLowerCase().includes(q)))out.push(toTaskRecord(t));}return out;},
      captureSnapshot: async(userId,id)=>{ensureUser(userId);return taskSnapshot(getTask(userId,id,true));},
      restoreSnapshot: async(userId,snapshot)=>{ensureUser(userId);const t=getTask(userId,snapshot.taskId,true);restore(t,snapshot);},
    },
    views: {
      inbox: async(userId)=>{ensureUser(userId);return [...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter(isTaskInInbox);},
      today: async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskDueToday(t,now,tz)),"today",now);},
      upcoming: async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskUpcoming(t,now,tz)),"upcoming",now);},
      overdue: async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskOverdue(t,now,tz)),"overdue",now);},
      completed: async(userId)=>{ensureUser(userId);return [...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter(isTaskCompleted).sort((a,b)=>(b.completedAt??"").localeCompare(a.completedAt??""));},
      focus: async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskFocus(t,now,tz)),"focus",now);},
    },
    projects: {
      list: async(userId)=>{ensureUser(userId);return [...projects.values()].filter((p)=>p.userId===userId&&!p.deletedAt&&p.status!=="ARCHIVED").sort((a,b)=>a.sortOrder-b.sortOrder).map((p)=>serializeProject(p as never));},
      create: async(userId,input)=>{ensureUser(userId);const p:DbProject={id:cuid(),userId,name:input.name,description:input.description??null,color:input.color??null,icon:input.icon??null,status:"ACTIVE",sortOrder:0,createdAt:new Date(),updatedAt:new Date(),archivedAt:null,deletedAt:null};projects.set(p.id,p);return serializeProject(p as never);},
      get: async(userId,id)=>serializeProject(getProject(userId,id) as never),
      update: async(userId,id,input)=>{const p=getProject(userId,id);if(input.name!==undefined)p.name=input.name;if(input.description!==undefined)p.description=input.description;if(input.color!==undefined)p.color=input.color;if(input.icon!==undefined)p.icon=input.icon;if(input.status!==undefined)p.status=input.status.toUpperCase() as DbProject["status"];p.updatedAt=new Date();return serializeProject(p as never);},
      archive: async(userId,id)=>{const p=getProject(userId,id);p.status="ARCHIVED";p.archivedAt=new Date();p.updatedAt=new Date();return serializeProject(p as never);},
      delete: async(userId,id)=>{const p=getProject(userId,id);p.deletedAt=new Date();p.updatedAt=new Date();},
    },
    sections: {
      list: async(userId,projectId)=>{ensureUser(userId);getProject(userId,projectId);return [...sections.values()].filter((s)=>s.projectId===projectId&&!s.deletedAt).sort((a,b)=>a.sortOrder-b.sortOrder).map((s)=>serializeSection(s as never));},
      create: async(userId,input)=>{ensureUser(userId);getProject(userId,input.projectId);const s:DbSection={id:cuid(),projectId:input.projectId,name:input.name,sortOrder:0,createdAt:new Date(),updatedAt:new Date(),deletedAt:null};sections.set(s.id,s);return serializeSection(s as never);},
      update: async(userId,projectId,id,input)=>{getProject(userId,projectId);const s=getSection(userId,id);if(s.projectId!==projectId)throw Errors.NotFound("Section");if(input.name!==undefined)s.name=input.name;if(input.sortOrder!==undefined)s.sortOrder=input.sortOrder;s.updatedAt=new Date();return serializeSection(s as never);},
      delete: async(userId,projectId,id)=>{getProject(userId,projectId);const s=getSection(userId,id);if(s.projectId!==projectId)throw Errors.NotFound("Section");s.deletedAt=new Date();s.updatedAt=new Date();for(const t of tasks.values())if(t.sectionId===id)t.sectionId=null;},
    },
    tags: {
      list: async(userId)=>{ensureUser(userId);return [...tags.values()].filter((t)=>t.userId===userId&&!t.deletedAt).sort((a,b)=>a.name.localeCompare(b.name)).map((t)=>serializeTag(t));},
      create: async(userId,input)=>{ensureUser(userId);for(const t of tags.values())if(t.userId===userId&&!t.deletedAt&&t.name===input.name)throw Errors.Conflict(`Tag "${input.name}" already exists.`);const t:DbTag={id:cuid(),userId,name:input.name,color:input.color??null,createdAt:new Date(),updatedAt:new Date(),deletedAt:null};tags.set(t.id,t);return serializeTag(t);},
      update: async(userId,id,input)=>{const t=getTag(userId,id);if(input.name!==undefined){for(const other of tags.values())if(other.id!==id&&other.userId===userId&&!other.deletedAt&&other.name===input.name)throw Errors.Conflict(`Tag "${input.name}" already exists.`);t.name=input.name;}if(input.color!==undefined)t.color=input.color;t.updatedAt=new Date();return serializeTag(t);},
      delete: async(userId,id)=>{const t=getTag(userId,id);t.deletedAt=new Date();t.updatedAt=new Date();for(const task of tasks.values())task.tagIds=task.tagIds.filter((x)=>x!==id);},
      getByName: async(userId,name)=>{ensureUser(userId);const t=[...tags.values()].find((t)=>t.userId===userId&&!t.deletedAt&&t.name===name);return t?serializeTag(t):null;},
      verifyBelongToUser: async(userId,ids)=>{ensureUser(userId);for(const id of ids)getTag(userId,id);},
    },
    comments: {
      list: async(userId,taskId)=>{ensureUser(userId);getTask(userId,taskId);return [...comments.values()].filter((c)=>c.taskId===taskId&&c.userId===userId&&!c.deletedAt).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()).map((c)=>serializeComment(c as never));},
      create: async(userId,taskId,input)=>{ensureUser(userId);getTask(userId,taskId);const c:DbComment={id:cuid(),taskId,userId,body:input.body,deletedAt:null,createdAt:new Date(),updatedAt:new Date()};comments.set(c.id,c);return serializeComment(c as never);},
      update: async(userId,taskId,id,input)=>{const c=getComment(userId,taskId,id);c.body=input.body;c.updatedAt=new Date();return serializeComment(c as never);},
      delete: async(userId,taskId,id)=>{const c=getComment(userId,taskId,id);c.deletedAt=new Date();c.updatedAt=new Date();},
    },
    reminders: {
      list: async(userId,taskId)=>{ensureUser(userId);getTask(userId,taskId);return [...reminders.values()].filter((r)=>r.userId===userId&&r.taskId===taskId&&!r.deletedAt).sort((a,b)=>a.remindAt.getTime()-b.remindAt.getTime()).map((r)=>serializeReminder(r as never));},
      create: async(userId,taskId,input)=>{ensureUser(userId);getTask(userId,taskId);const r:DbReminder={id:cuid(),taskId,userId,remindAt:new Date(input.remindAt),channel:input.channel??"push",status:"pending",createdAt:new Date(),updatedAt:new Date(),deletedAt:null};reminders.set(r.id,r);return serializeReminder(r as never);},
      update: async(userId,id,input)=>{const r=getReminder(userId,id);if(input.remindAt!==undefined)r.remindAt=new Date(input.remindAt);if(input.channel!==undefined)r.channel=input.channel;if(input.status!==undefined)r.status=input.status;r.updatedAt=new Date();return serializeReminder(r as never);},
      delete: async(userId,id)=>{const r=getReminder(userId,id);r.deletedAt=new Date();r.updatedAt=new Date();},
    },
    events: {
      list: async(userId,taskId)=>{ensureUser(userId);if(taskId)getTask(userId,taskId,true);return [...events.values()].filter((e)=>e.userId===userId&&(!taskId||e.taskId===taskId)).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,100).map((e)=>serializeTaskEvent(e as never));},
      record: async(userId,taskId,kind,payload)=>{ensureUser(userId);getTask(userId,taskId,true);const e:DbEvent={id:cuid(),userId,taskId,kind,payload:payload??null,createdAt:new Date()};events.set(e.id,e);return serializeTaskEvent(e as never);},
    },
    operations: {
      record: async(userId,kind,payload,taskId)=>{ensureUser(userId);const o:DbOperation={id:cuid(),userId,taskId:taskId??null,kind,payload,undoneAt:null,createdAt:new Date(),sequence:++operationSequence};operations.set(o.id,o);return serializeOperation(o as never);},
      list: async(userId)=>{ensureUser(userId);return [...operations.values()].filter((o)=>o.userId===userId).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.sequence-a.sequence).slice(0,3).map((o)=>serializeOperation(o as never));},
      undoLast: async(userId)=>{ensureUser(userId);const o=[...operations.values()].filter((o)=>o.userId===userId&&!o.undoneAt).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.sequence-a.sequence)[0];if(!o)throw Errors.NotFound("Operation");return repo.operations.undo(userId,o.id);},
      undo: async(userId,id)=>{ensureUser(userId);const o=operations.get(id);if(!o||o.userId!==userId)throw Errors.NotFound("Operation");if(o.undoneAt)throw Errors.Conflict("Operation already undone.");const payload=o.payload as Record<string,unknown>;let redoSnapshots:TaskSnapshot[]=[];if(o.kind==="TASK_CREATE"){const taskId=payload.taskId as string;redoSnapshots=[await repo.tasks.captureSnapshot(userId,taskId)];const t=getTask(userId,taskId,true);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();}else if(["TASK_UPDATE","TASK_DELETE","TASK_COMPLETE","TASK_REOPEN"].includes(o.kind)){const original=payload as unknown as TaskSnapshot;redoSnapshots=[await repo.tasks.captureSnapshot(userId,original.taskId)];await repo.tasks.restoreSnapshot(userId,original);}else if(["TASK_BULK_UPDATE","TASK_BULK_COMPLETE","TASK_BULK_DELETE","TASK_BULK_MOVE"].includes(o.kind)){const originals=(payload.snapshots as TaskSnapshot[]??[]);redoSnapshots=await Promise.all(originals.map((snapshot)=>repo.tasks.captureSnapshot(userId,snapshot.taskId)));for(const snapshot of originals)await repo.tasks.restoreSnapshot(userId,snapshot);}else throw Errors.Validation(`Undo not supported for operation kind: ${o.kind}`);o.payload={...payload,redoSnapshots};o.undoneAt=new Date();return serializeOperation(o as never);},
      redoLast: async(userId)=>{ensureUser(userId);const o=[...operations.values()].filter((o)=>o.userId===userId&&o.undoneAt).sort((a,b)=>(b.undoneAt?.getTime()??0)-(a.undoneAt?.getTime()??0)||a.sequence-b.sequence)[0];if(!o)throw Errors.NotFound("Operation");return repo.operations.redo(userId,o.id);},
      redo: async(userId,id)=>{ensureUser(userId);const o=operations.get(id);if(!o||o.userId!==userId)throw Errors.NotFound("Operation");if(!o.undoneAt)throw Errors.Conflict("Operation is not undone.");const payload=o.payload as Record<string,unknown>;const redoSnapshots=(payload.redoSnapshots as TaskSnapshot[]??[]);if(!redoSnapshots.length)throw Errors.Conflict("Operation cannot be redone.");for(const snapshot of redoSnapshots)await repo.tasks.restoreSnapshot(userId,snapshot);o.undoneAt=null;return serializeOperation(o as never);},
    },
  };
  return repo;
}
