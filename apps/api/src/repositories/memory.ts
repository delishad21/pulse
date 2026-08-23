import {
  isTaskFocus,
  isTaskOverdue,
  normalizeTaskSchedule,
  parseRecurrenceRule,
  sortTasksForView,
  taskViewDate,
  type Task,
} from "@pulse/domain";
import { Errors } from "../lib/errors.js";
import {
  serializeComment,
  serializeOperation,
  serializeProject,
  serializeReminder,
  serializeTag,
  serializeTask,
  serializeTaskEvent,
} from "../services/task-serializer.js";
import type { PulseRepository, TaskSnapshot } from "./types.js";

const cuid = () => `cuid_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
type TaskStatusDb = "OPEN" | "COMPLETED" | "CANCELLED";
type PriorityDb = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
interface DbTask {
  id:string; userId:string; projectId:string|null; parentTaskId:string|null;
  title:string; description:string|null; location:string|null; status:TaskStatusDb; priority:PriorityDb;
  startAt:Date|null; endAt:Date|null; dueDate:Date|null; dueAt:Date|null; recurrenceRule:string|null;
  completedAt:Date|null; deletedAt:Date|null; sortOrder:number; revision:number; createdAt:Date; updatedAt:Date; tagIds:string[];
}
interface DbProject { id:string; userId:string; name:string; description:string|null; color:string|null; icon:string|null; status:"ACTIVE"|"ARCHIVED"|"COMPLETED"; sortOrder:number; createdAt:Date; updatedAt:Date; archivedAt:Date|null; deletedAt:Date|null; }
interface DbTag { id:string; userId:string; name:string; color:string|null; createdAt:Date; updatedAt:Date; deletedAt:Date|null; }
interface DbComment { id:string; taskId:string; userId:string; body:string; deletedAt:Date|null; createdAt:Date; updatedAt:Date; }
interface DbReminder { id:string; taskId:string; userId:string; remindAt:Date; channel:string; status:string; createdAt:Date; updatedAt:Date; deletedAt:Date|null; }
interface DbEvent { id:string; taskId:string; userId:string; kind:string; payload:unknown; createdAt:Date; }
interface DbOperation { id:string; userId:string; taskId:string|null; kind:string; payload:unknown; undoneAt:Date|null; createdAt:Date; sequence:number; }

function parsePriority(value:string):PriorityDb { return value.toUpperCase() as PriorityDb; }
function validateRecurrence(value:string|null|undefined):void { if(value) parseRecurrenceRule(value); }

export function createMemoryRepository(initialUserId?:string, additionalUserIds:string[]=[]):PulseRepository {
  const users=new Map<string,{id:string}>();
  const tasks=new Map<string,DbTask>(); const projects=new Map<string,DbProject>(); const tags=new Map<string,DbTag>();
  const comments=new Map<string,DbComment>(); const reminders=new Map<string,DbReminder>(); const events=new Map<string,DbEvent>(); const operations=new Map<string,DbOperation>();
  let operationSequence=0;
  if(initialUserId) users.set(initialUserId,{id:initialUserId}); for(const id of additionalUserIds) users.set(id,{id});

  const ensureUser=(userId:string)=>{if(!users.has(userId))throw Errors.Unauthorized();};
  const getTask=(userId:string,id:string,includeDeleted=false)=>{const t=tasks.get(id);if(!t||t.userId!==userId||(!includeDeleted&&t.deletedAt))throw Errors.NotFound("Task");return t;};
  const getProject=(userId:string,id:string)=>{const p=projects.get(id);if(!p||p.userId!==userId||p.deletedAt)throw Errors.NotFound("Project");return p;};
  const getTag=(userId:string,id:string)=>{const t=tags.get(id);if(!t||t.userId!==userId||t.deletedAt)throw Errors.NotFound("Tag");return t;};
  const getComment=(userId:string,taskId:string,id:string)=>{getTask(userId,taskId);const c=comments.get(id);if(!c||c.userId!==userId||c.taskId!==taskId||c.deletedAt)throw Errors.NotFound("Comment");return c;};
  const getReminder=(userId:string,id:string)=>{const r=reminders.get(id);if(!r||r.userId!==userId||r.deletedAt)throw Errors.NotFound("Reminder");getTask(userId,r.taskId);return r;};

  function taskReminders(taskId:string):DbReminder[]{return [...reminders.values()].filter((r)=>r.taskId===taskId&&!r.deletedAt).sort((a,b)=>a.remindAt.getTime()-b.remindAt.getTime());}
  function toTaskRecord(task:DbTask):Task {
    const tagRows=task.tagIds.map((id)=>tags.get(id)).filter((tag):tag is DbTag=>Boolean(tag&&!tag.deletedAt)).map((tag)=>({tag}));
    return serializeTask({...task,tags:tagRows,reminders:taskReminders(task.id)} as never);
  }
  function reminderSnapshot(taskId:string){return taskReminders(taskId).map((r)=>({remindAt:r.remindAt.toISOString(),channel:r.channel,status:r.status}));}
  function taskSnapshot(task:DbTask):TaskSnapshot {return {taskId:task.id,before:{title:task.title,description:task.description,location:task.location,status:task.status,priority:task.priority,startAt:task.startAt?.toISOString()??null,endAt:task.endAt?.toISOString()??null,dueDate:task.dueDate?.toISOString()??null,dueAt:task.dueAt?.toISOString()??null,recurrenceRule:task.recurrenceRule,projectId:task.projectId,parentTaskId:task.parentTaskId,tagIds:[...task.tagIds],reminders:reminderSnapshot(task.id),completedAt:task.completedAt?.toISOString()??null,deletedAt:task.deletedAt?.toISOString()??null,sortOrder:task.sortOrder,revision:task.revision}};}
  function replaceReminders(userId:string,taskId:string,values:Array<{remindAt:string;channel?:string;status?:string}>):void {
    const now=new Date(); for(const r of reminders.values())if(r.taskId===taskId&&!r.deletedAt){r.deletedAt=now;r.updatedAt=now;}
    for(const value of values){const r:DbReminder={id:cuid(),userId,taskId,remindAt:new Date(value.remindAt),channel:value.channel??"hermes_telegram",status:value.status??"pending",createdAt:new Date(),updatedAt:new Date(),deletedAt:null};reminders.set(r.id,r);}
  }
  function restore(task:DbTask,snapshot:TaskSnapshot):void {
    const b=snapshot.before; task.title=b.title as string; task.description=(b.description as string|null)??null; task.location=(b.location as string|null)??null; task.status=b.status as TaskStatusDb; task.priority=b.priority as PriorityDb;
    task.startAt=b.startAt?new Date(b.startAt as string):null; task.endAt=b.endAt?new Date(b.endAt as string):null; task.dueDate=b.dueDate?new Date(b.dueDate as string):null; task.dueAt=b.dueAt?new Date(b.dueAt as string):null;
    task.recurrenceRule=(b.recurrenceRule as string|null)??null; task.projectId=(b.projectId as string|null)??null; task.parentTaskId=(b.parentTaskId as string|null)??null; task.tagIds=[...((b.tagIds as string[])??[])];
    task.completedAt=b.completedAt?new Date(b.completedAt as string):null; task.deletedAt=b.deletedAt?new Date(b.deletedAt as string):null; task.sortOrder=Number(b.sortOrder??0); task.revision=Number(b.revision??task.revision)+1; task.updatedAt=new Date();
    replaceReminders(task.userId,task.id,(b.reminders as Array<{remindAt:string;channel?:string;status?:string}>)??[]);
  }
  async function validateRelations(userId:string,input:{projectId?:string|null;parentTaskId?:string|null;tagIds?:string[];addTagIds?:string[];removeTagIds?:string[]}){
    if(input.projectId)getProject(userId,input.projectId); if(input.parentTaskId)getTask(userId,input.parentTaskId);
    for(const id of new Set([...(input.tagIds??[]),...(input.addTagIds??[]),...(input.removeTagIds??[])]))getTag(userId,id);
  }
  function statusAllowed(task:Task,includeCompleted:boolean){return task.status==="open"||(includeCompleted&&task.status==="completed");}
  function mergedSchedule(task:DbTask,input:{startAt?:string|null;endAt?:string|null;dueDate?:string|null;dueAt?:string|null}) {
    const startAt=input.startAt===undefined?(task.startAt?.toISOString()??null):input.startAt;
    const endAt=input.endAt===undefined?(task.endAt?.toISOString()??null):input.endAt;
    let dueDate=input.dueDate===undefined?(task.dueDate?.toISOString().slice(0,10)??null):input.dueDate;
    let dueAt=input.dueAt===undefined?(task.dueAt?.toISOString()??null):input.dueAt;
    if(input.dueDate!==undefined&&input.dueAt===undefined)dueAt=null;
    if(input.dueAt!==undefined&&input.dueDate===undefined)dueDate=null;
    return normalizeTaskSchedule({startAt,endAt,dueDate,dueAt});
  }

  const repo:PulseRepository={
    healthCheck:async()=>({database:"in-memory"}),
    tasks:{
      list:async(userId,filters={})=>{ensureUser(userId);return [...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt&&(!filters.status||t.status===filters.status.toUpperCase())&&(filters.projectId===undefined||t.projectId===filters.projectId)).map(toTaskRecord).sort((a,b)=>a.sortOrder-b.sortOrder||a.createdAt.localeCompare(b.createdAt));},
      create:async(userId,input)=>{ensureUser(userId);validateRecurrence(input.recurrenceRule);await validateRelations(userId,input);const s=normalizeTaskSchedule(input);const task:DbTask={id:cuid(),userId,title:input.title,description:input.description??null,location:input.location??null,status:"OPEN",priority:parsePriority(input.priority??"none"),startAt:s.startAt?new Date(s.startAt):null,endAt:s.endAt?new Date(s.endAt):null,dueDate:s.due.date?new Date(`${s.due.date}T00:00:00Z`):null,dueAt:s.due.at?new Date(s.due.at):null,recurrenceRule:input.recurrenceRule??null,projectId:input.projectId??null,parentTaskId:input.parentTaskId??null,completedAt:null,deletedAt:null,sortOrder:input.sortOrder??0,revision:0,createdAt:new Date(),updatedAt:new Date(),tagIds:[...(input.tagIds??[])]};tasks.set(task.id,task);if(input.reminders)replaceReminders(userId,task.id,input.reminders);return toTaskRecord(task);},
      get:async(userId,id)=>{ensureUser(userId);return toTaskRecord(getTask(userId,id));},
      update:async(userId,id,input)=>{ensureUser(userId);const t=getTask(userId,id);validateRecurrence(input.recurrenceRule);await validateRelations(userId,input);const s=mergedSchedule(t,input);if(input.title!==undefined)t.title=input.title;if(input.description!==undefined)t.description=input.description;if(input.location!==undefined)t.location=input.location;if(input.priority!==undefined)t.priority=parsePriority(input.priority);if(input.startAt!==undefined)t.startAt=s.startAt?new Date(s.startAt):null;if(input.endAt!==undefined)t.endAt=s.endAt?new Date(s.endAt):null;if(input.dueDate!==undefined){t.dueDate=s.due.date?new Date(`${s.due.date}T00:00:00Z`):null;if(input.dueAt===undefined)t.dueAt=null;}if(input.dueAt!==undefined){t.dueAt=s.due.at?new Date(s.due.at):null;if(input.dueDate===undefined)t.dueDate=null;}if(input.recurrenceRule!==undefined)t.recurrenceRule=input.recurrenceRule;if(input.projectId!==undefined)t.projectId=input.projectId;if(input.parentTaskId!==undefined)t.parentTaskId=input.parentTaskId;if(input.sortOrder!==undefined)t.sortOrder=input.sortOrder;if(input.tagIds!==undefined)t.tagIds=[...input.tagIds];if(input.reminders!==undefined)replaceReminders(userId,id,input.reminders);t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      delete:async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();},
      complete:async(userId,id,completedAt)=>{ensureUser(userId);const t=getTask(userId,id);t.status="COMPLETED";t.completedAt=completedAt;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      reopen:async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.status="OPEN";t.completedAt=null;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      cancel:async(userId,id)=>{ensureUser(userId);const t=getTask(userId,id);t.status="CANCELLED";t.completedAt=null;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);},
      bulkComplete:async(userId,ids,completedAt)=>{ensureUser(userId);return ids.map((id)=>{const t=getTask(userId,id);t.status="COMPLETED";t.completedAt=completedAt;t.revision+=1;t.updatedAt=new Date();return toTaskRecord(t);});},
      bulkDelete:async(userId,ids)=>{ensureUser(userId);for(const id of ids){const t=getTask(userId,id);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();}},
      bulkUpdate:async(userId,input)=>{ensureUser(userId);validateRecurrence(input.recurrenceRule);await validateRelations(userId,input);const out:Task[]=[];for(const id of input.ids){const t=getTask(userId,id);const s=mergedSchedule(t,input);if(input.title!==undefined)t.title=input.title;if(input.priority!==undefined)t.priority=parsePriority(input.priority);if(input.startAt!==undefined)t.startAt=s.startAt?new Date(s.startAt):null;if(input.endAt!==undefined)t.endAt=s.endAt?new Date(s.endAt):null;if(input.dueDate!==undefined){t.dueDate=s.due.date?new Date(`${s.due.date}T00:00:00Z`):null;if(input.dueAt===undefined)t.dueAt=null;}if(input.dueAt!==undefined){t.dueAt=s.due.at?new Date(s.due.at):null;if(input.dueDate===undefined)t.dueDate=null;}if(input.recurrenceRule!==undefined)t.recurrenceRule=input.recurrenceRule;if(input.projectId!==undefined)t.projectId=input.projectId;if(input.addTagIds)for(const tagId of input.addTagIds)if(!t.tagIds.includes(tagId))t.tagIds.push(tagId);if(input.removeTagIds)t.tagIds=t.tagIds.filter((x)=>!input.removeTagIds!.includes(x));t.revision+=1;t.updatedAt=new Date();out.push(toTaskRecord(t));}return out;},
      search:async(userId,query)=>{ensureUser(userId);const q=query.toLowerCase();return [...tasks.values()].filter((t)=>{if(t.userId!==userId||t.deletedAt)return false;const p=t.projectId?projects.get(t.projectId)?.name??"":"";const tagNames=t.tagIds.map((id)=>tags.get(id)?.name??"").join(" ");const bodies=[...comments.values()].filter((c)=>c.taskId===t.id&&!c.deletedAt).map((c)=>c.body).join(" ");return[t.title,t.description??"",t.location??"",p,tagNames,bodies].some((v)=>v.toLowerCase().includes(q));}).map(toTaskRecord);},
      captureSnapshot:async(userId,id)=>{ensureUser(userId);return taskSnapshot(getTask(userId,id,true));},
      restoreSnapshot:async(userId,snapshot)=>{ensureUser(userId);restore(getTask(userId,snapshot.taskId,true),snapshot);},
    },
    views:{
      inbox:async(userId,includeCompleted=false)=>{ensureUser(userId);return [...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt&&t.projectId===null).map(toTaskRecord).filter((t)=>statusAllowed(t,includeCompleted));},
      today:async(userId,now,tz,includeCompleted=false)=>{ensureUser(userId);const date=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>statusAllowed(t,includeCompleted)&&taskViewDate(t,tz)===date),"today",now);},
      upcoming:async(userId,now,tz,includeCompleted=false)=>{ensureUser(userId);const date=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>statusAllowed(t,includeCompleted)&&((taskViewDate(t,tz)??"")>date)),"upcoming",now);},
      overdue:async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskOverdue(t,now,tz)),"overdue",now);},
      completed:async(userId)=>{ensureUser(userId);return [...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt&&t.status==="COMPLETED").map(toTaskRecord).sort((a,b)=>(b.completedAt??"").localeCompare(a.completedAt??""));},
      focus:async(userId,now,tz)=>{ensureUser(userId);return sortTasksForView([...tasks.values()].filter((t)=>t.userId===userId&&!t.deletedAt).map(toTaskRecord).filter((t)=>isTaskFocus(t,now,tz)),"focus",now);},
    },
    projects:{
      list:async(userId)=>{ensureUser(userId);return [...projects.values()].filter((p)=>p.userId===userId&&!p.deletedAt&&p.status!=="ARCHIVED").sort((a,b)=>a.sortOrder-b.sortOrder).map((p)=>serializeProject(p as never));},
      create:async(userId,input)=>{ensureUser(userId);const p:DbProject={id:cuid(),userId,name:input.name,description:input.description??null,color:input.color??null,icon:input.icon??null,status:"ACTIVE",sortOrder:0,createdAt:new Date(),updatedAt:new Date(),archivedAt:null,deletedAt:null};projects.set(p.id,p);return serializeProject(p as never);},
      get:async(userId,id)=>serializeProject(getProject(userId,id) as never),
      update:async(userId,id,input)=>{const p=getProject(userId,id);if(input.name!==undefined)p.name=input.name;if(input.description!==undefined)p.description=input.description;if(input.color!==undefined)p.color=input.color;if(input.icon!==undefined)p.icon=input.icon;if(input.status!==undefined)p.status=input.status.toUpperCase() as DbProject["status"];p.updatedAt=new Date();return serializeProject(p as never);},
      archive:async(userId,id)=>{const p=getProject(userId,id);p.status="ARCHIVED";p.archivedAt=new Date();p.updatedAt=new Date();return serializeProject(p as never);},
      delete:async(userId,id)=>{const p=getProject(userId,id);p.deletedAt=new Date();p.updatedAt=new Date();},
    },
    tags:{
      list:async(userId)=>{ensureUser(userId);return [...tags.values()].filter((t)=>t.userId===userId&&!t.deletedAt).sort((a,b)=>a.name.localeCompare(b.name)).map(serializeTag);},
      create:async(userId,input)=>{ensureUser(userId);for(const t of tags.values())if(t.userId===userId&&!t.deletedAt&&t.name===input.name)throw Errors.Conflict(`Tag "${input.name}" already exists.`);const t:DbTag={id:cuid(),userId,name:input.name,color:input.color??null,createdAt:new Date(),updatedAt:new Date(),deletedAt:null};tags.set(t.id,t);return serializeTag(t);},
      update:async(userId,id,input)=>{const t=getTag(userId,id);if(input.name!==undefined)t.name=input.name;if(input.color!==undefined)t.color=input.color;t.updatedAt=new Date();return serializeTag(t);},
      delete:async(userId,id)=>{const t=getTag(userId,id);t.deletedAt=new Date();t.updatedAt=new Date();for(const task of tasks.values())task.tagIds=task.tagIds.filter((x)=>x!==id);},
      getByName:async(userId,name)=>{ensureUser(userId);const t=[...tags.values()].find((x)=>x.userId===userId&&!x.deletedAt&&x.name===name);return t?serializeTag(t):null;},
      verifyBelongToUser:async(userId,ids)=>{ensureUser(userId);for(const id of ids)getTag(userId,id);},
    },
    comments:{
      list:async(userId,taskId)=>{ensureUser(userId);getTask(userId,taskId);return [...comments.values()].filter((c)=>c.taskId===taskId&&c.userId===userId&&!c.deletedAt).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()).map((c)=>serializeComment(c as never));},
      create:async(userId,taskId,input)=>{ensureUser(userId);getTask(userId,taskId);const c:DbComment={id:cuid(),taskId,userId,body:input.body,deletedAt:null,createdAt:new Date(),updatedAt:new Date()};comments.set(c.id,c);return serializeComment(c as never);},
      update:async(userId,taskId,id,input)=>{const c=getComment(userId,taskId,id);c.body=input.body;c.updatedAt=new Date();return serializeComment(c as never);},
      delete:async(userId,taskId,id)=>{const c=getComment(userId,taskId,id);c.deletedAt=new Date();c.updatedAt=new Date();},
    },
    reminders:{
      list:async(userId,taskId)=>{ensureUser(userId);getTask(userId,taskId);return taskReminders(taskId).map((r)=>serializeReminder(r as never));},
      create:async(userId,taskId,input)=>{ensureUser(userId);getTask(userId,taskId);const r:DbReminder={id:cuid(),taskId,userId,remindAt:new Date(input.remindAt),channel:input.channel??"hermes_telegram",status:"pending",createdAt:new Date(),updatedAt:new Date(),deletedAt:null};reminders.set(r.id,r);return serializeReminder(r as never);},
      update:async(userId,id,input)=>{const r=getReminder(userId,id);if(input.remindAt!==undefined)r.remindAt=new Date(input.remindAt);if(input.channel!==undefined)r.channel=input.channel;if(input.status!==undefined)r.status=input.status;r.updatedAt=new Date();return serializeReminder(r as never);},
      delete:async(userId,id)=>{const r=getReminder(userId,id);r.deletedAt=new Date();r.updatedAt=new Date();},
    },
    events:{
      list:async(userId,taskId)=>{ensureUser(userId);if(taskId)getTask(userId,taskId,true);return [...events.values()].filter((e)=>e.userId===userId&&(!taskId||e.taskId===taskId)).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,100).map((e)=>serializeTaskEvent(e as never));},
      record:async(userId,taskId,kind,payload)=>{ensureUser(userId);getTask(userId,taskId,true);const e:DbEvent={id:cuid(),userId,taskId,kind,payload:payload??null,createdAt:new Date()};events.set(e.id,e);return serializeTaskEvent(e as never);},
    },
    operations:{
      record:async(userId,kind,payload,taskId)=>{ensureUser(userId);const o:DbOperation={id:cuid(),userId,taskId:taskId??null,kind,payload,undoneAt:null,createdAt:new Date(),sequence:++operationSequence};operations.set(o.id,o);return serializeOperation(o as never);},
      list:async(userId)=>{ensureUser(userId);return [...operations.values()].filter((o)=>o.userId===userId).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.sequence-a.sequence).slice(0,3).map((o)=>serializeOperation(o as never));},
      undoLast:async(userId)=>{const o=[...operations.values()].filter((x)=>x.userId===userId&&!x.undoneAt).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.sequence-a.sequence)[0];if(!o)throw Errors.NotFound("Operation");return repo.operations.undo(userId,o.id);},
      undo:async(userId,id)=>{ensureUser(userId);const o=operations.get(id);if(!o||o.userId!==userId)throw Errors.NotFound("Operation");if(o.undoneAt)throw Errors.Conflict("Operation already undone.");const p=o.payload as Record<string,unknown>;let originals:TaskSnapshot[]=[];let spawned:string[]=[];if(o.kind==="TASK_CREATE"){const taskId=p.taskId as string;const redoSnapshots=[await repo.tasks.captureSnapshot(userId,taskId)];getTask(userId,taskId,true).deletedAt=new Date();o.payload={...p,redoSnapshots};o.undoneAt=new Date();return serializeOperation(o as never);}if(o.kind==="TASK_COMPLETE"){originals=[(p.snapshot as TaskSnapshot)??(p as unknown as TaskSnapshot)];spawned=(p.spawnedTaskIds as string[])??[];}else if(["TASK_UPDATE","TASK_DELETE","TASK_REOPEN"].includes(o.kind)){originals=[(p.snapshot as TaskSnapshot)??(p as unknown as TaskSnapshot)];}else if(["TASK_BULK_UPDATE","TASK_BULK_COMPLETE","TASK_BULK_DELETE","TASK_BULK_MOVE"].includes(o.kind)){originals=(p.snapshots as TaskSnapshot[])??[];spawned=(p.spawnedTaskIds as string[])??[];}else throw Errors.Validation(`Undo not supported for operation kind: ${o.kind}`);const redoSnapshots=await Promise.all([...originals.map((s)=>s.taskId),...spawned].map((taskId)=>repo.tasks.captureSnapshot(userId,taskId)));for(const s of originals)await repo.tasks.restoreSnapshot(userId,s);for(const taskId of spawned){const t=getTask(userId,taskId,true);t.deletedAt=new Date();t.revision+=1;t.updatedAt=new Date();}o.payload={...p,redoSnapshots};o.undoneAt=new Date();return serializeOperation(o as never);},
      redoLast:async(userId)=>{const o=[...operations.values()].filter((x)=>x.userId===userId&&x.undoneAt).sort((a,b)=>(b.undoneAt?.getTime()??0)-(a.undoneAt?.getTime()??0)||a.sequence-b.sequence)[0];if(!o)throw Errors.NotFound("Operation");return repo.operations.redo(userId,o.id);},
      redo:async(userId,id)=>{ensureUser(userId);const o=operations.get(id);if(!o||o.userId!==userId)throw Errors.NotFound("Operation");if(!o.undoneAt)throw Errors.Conflict("Operation is not undone.");const p=o.payload as Record<string,unknown>;const redo=(p.redoSnapshots as TaskSnapshot[])??[];if(!redo.length)throw Errors.Conflict("Operation cannot be redone.");for(const s of redo)await repo.tasks.restoreSnapshot(userId,s);o.undoneAt=null;return serializeOperation(o as never);},
    },
  };
  return repo;
}
