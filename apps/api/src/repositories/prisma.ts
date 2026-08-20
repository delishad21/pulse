import { prisma } from "@pulse/db";
import { dayBoundsInTimezone, formatDateInTimezone, normalizeTaskSchedule, parseRecurrenceRule } from "@pulse/domain";
import { Errors } from "../lib/errors.js";
import { serializeComment, serializeOperation, serializeProject, serializeReminder, serializeSection, serializeTag, serializeTask, serializeTaskEvent } from "../services/task-serializer.js";
import type { PulseRepository, TaskSnapshot } from "./types.js";

const taskInclude = { tags: { include: { tag: true } } } as const;
function found<T>(value: T | null | undefined, resource: string): asserts value is T { if (!value) throw Errors.NotFound(resource); }
function priority(value: string) { return value.toUpperCase() as "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"; }
function status(value: string) { return value.toUpperCase() as "OPEN" | "COMPLETED" | "CANCELLED"; }
function validateRecurrence(value: string | null | undefined) { if (value) parseRecurrenceRule(value); }

async function ensureProject(userId: string, id: string) {
  const p = await prisma.project.findFirst({ where: { id, userId, deletedAt: null } }); found(p, "Project"); return p;
}
async function ensureSection(userId: string, id: string) {
  const s = await prisma.section.findFirst({ where: { id, deletedAt: null, project: { userId, deletedAt: null } } }); found(s, "Section"); return s;
}
async function ensureTask(userId: string, id: string, includeDeleted = false) {
  const t = await prisma.task.findFirst({ where: { id, userId, deletedAt: includeDeleted ? undefined : null } }); found(t, "Task"); return t;
}
async function ensureTags(userId: string, ids: string[]) {
  const unique = [...new Set(ids)]; if (!unique.length) return;
  const count = await prisma.tag.count({ where: { id: { in: unique }, userId, deletedAt: null } });
  if (count !== unique.length) throw Errors.Validation("One or more tags do not belong to the user.");
}
async function ensureTaskIds(userId: string, ids: string[]) {
  const unique = [...new Set(ids)]; const count = await prisma.task.count({ where: { id: { in: unique }, userId, deletedAt: null } });
  if (count !== unique.length) throw Errors.NotFound("Task");
}
async function relationTargets(userId: string, input: { projectId?: string | null; sectionId?: string | null; parentTaskId?: string | null; tagIds?: string[]; addTagIds?: string[]; removeTagIds?: string[] }) {
  let projectId = input.projectId;
  if (projectId) await ensureProject(userId, projectId);
  if (input.sectionId) {
    const section = await ensureSection(userId, input.sectionId);
    if (projectId && section.projectId !== projectId) throw Errors.Validation("Section does not belong to the selected project.");
    if (projectId == null) projectId = section.projectId;
  }
  if (input.parentTaskId) await ensureTask(userId, input.parentTaskId);
  await ensureTags(userId, [...(input.tagIds ?? []), ...(input.addTagIds ?? []), ...(input.removeTagIds ?? [])]);
  return { projectId, sectionId: input.sectionId };
}
async function snapshot(userId: string, id: string): Promise<TaskSnapshot> {
  const t = await prisma.task.findFirst({ where: { id, userId }, include: { tags: { select: { tagId: true } } } }); found(t, "Task");
  return { taskId: id, before: { title:t.title, description:t.description, status:t.status, priority:t.priority, dueDate:t.dueDate?.toISOString()??null, dueAt:t.dueAt?.toISOString()??null, reminderAt:t.reminderAt?.toISOString()??null, recurrenceRule:t.recurrenceRule, projectId:t.projectId, sectionId:t.sectionId, parentTaskId:t.parentTaskId, tagIds:t.tags.map((x)=>x.tagId), completedAt:t.completedAt?.toISOString()??null, deletedAt:t.deletedAt?.toISOString()??null, sortOrder:t.sortOrder, revision:t.revision } };
}
async function restoreSnapshot(userId: string, s: TaskSnapshot): Promise<void> {
  await ensureTask(userId, s.taskId, true); const b=s.before;
  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where:{id:s.taskId}, data:{ title:b.title as string, description:(b.description as string|null)??null, status:status(b.status as string), priority:priority(b.priority as string), dueDate:b.dueDate?new Date(b.dueDate as string):null, dueAt:b.dueAt?new Date(b.dueAt as string):null, reminderAt:b.reminderAt?new Date(b.reminderAt as string):null, recurrenceRule:(b.recurrenceRule as string|null)??null, projectId:(b.projectId as string|null)??null, sectionId:(b.sectionId as string|null)??null, parentTaskId:(b.parentTaskId as string|null)??null, completedAt:b.completedAt?new Date(b.completedAt as string):null, deletedAt:b.deletedAt?new Date(b.deletedAt as string):null, sortOrder:Number(b.sortOrder??0), revision:{increment:1} } });
    await tx.taskTag.deleteMany({where:{taskId:s.taskId}}); const tagIds=(b.tagIds as string[])??[]; if(tagIds.length) await tx.taskTag.createMany({data:tagIds.map((tagId)=>({taskId:s.taskId,tagId})),skipDuplicates:true});
  });
}

export const prismaRepository: PulseRepository = {
  healthCheck: async()=>{try{await prisma.$queryRaw`SELECT 1`;return{database:"connected"};}catch{return{database:"disconnected"};}},
  tasks: {
    list: async(userId,filters={}) => (await prisma.task.findMany({where:{userId,deletedAt:null,status:filters.status?status(filters.status):undefined,projectId:filters.projectId??undefined,sectionId:filters.sectionId??undefined},include:taskInclude,orderBy:[{sortOrder:"asc"},{createdAt:"desc"}]})).map(serializeTask),
    create: async(userId,input)=>{validateRecurrence(input.recurrenceRule);const rel=await relationTargets(userId,input);const schedule=normalizeTaskSchedule(input);let created=await prisma.task.create({data:{userId,title:input.title,description:input.description??null,priority:priority(input.priority??"none"),dueDate:schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null,dueAt:schedule.due.at?new Date(schedule.due.at):null,reminderAt:schedule.reminderAt?new Date(schedule.reminderAt):null,recurrenceRule:input.recurrenceRule??null,projectId:rel.projectId??null,sectionId:rel.sectionId??null,parentTaskId:input.parentTaskId??null},include:taskInclude});if(input.tagIds?.length){await prisma.taskTag.createMany({data:input.tagIds.map((tagId)=>({taskId:created.id,tagId}))});created=(await prisma.task.findUnique({where:{id:created.id},include:taskInclude}))!;}return serializeTask(created);},
    get: async(userId,id)=>{const t=await prisma.task.findFirst({where:{id,userId,deletedAt:null},include:taskInclude});found(t,"Task");return serializeTask(t);},
    update: async(userId,id,input)=>{await ensureTask(userId,id);validateRecurrence(input.recurrenceRule);const rel=await relationTargets(userId,input);const schedule=normalizeTaskSchedule(input);const data:Record<string,unknown>={revision:{increment:1}};if(input.title!==undefined)data.title=input.title;if(input.description!==undefined)data.description=input.description;if(input.priority!==undefined)data.priority=priority(input.priority);if(input.dueDate!==undefined)data.dueDate=schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null;if(input.dueAt!==undefined){data.dueAt=schedule.due.at?new Date(schedule.due.at):null;if(schedule.due.at)data.dueDate=null;}if(input.reminderAt!==undefined)data.reminderAt=schedule.reminderAt?new Date(schedule.reminderAt):null;if(input.recurrenceRule!==undefined)data.recurrenceRule=input.recurrenceRule;if(rel.projectId!==undefined)data.projectId=rel.projectId;if(rel.sectionId!==undefined)data.sectionId=rel.sectionId;if(input.parentTaskId!==undefined)data.parentTaskId=input.parentTaskId;await prisma.$transaction(async(tx)=>{if(input.tagIds!==undefined){await tx.taskTag.deleteMany({where:{taskId:id}});if(input.tagIds.length)await tx.taskTag.createMany({data:input.tagIds.map((tagId)=>({taskId:id,tagId}))});}await tx.task.update({where:{id},data});});const t=await prisma.task.findUnique({where:{id},include:taskInclude});found(t,"Task");return serializeTask(t);},
    delete: async(userId,id)=>{await ensureTask(userId,id);await prisma.task.update({where:{id},data:{deletedAt:new Date(),revision:{increment:1}}});},
    complete: async(userId,id)=>{await ensureTask(userId,id);return serializeTask(await prisma.task.update({where:{id},data:{status:"COMPLETED",completedAt:new Date(),revision:{increment:1}},include:taskInclude}));},
    reopen: async(userId,id)=>{await ensureTask(userId,id);return serializeTask(await prisma.task.update({where:{id},data:{status:"OPEN",completedAt:null,revision:{increment:1}},include:taskInclude}));},
    cancel: async(userId,id)=>{await ensureTask(userId,id);return serializeTask(await prisma.task.update({where:{id},data:{status:"CANCELLED",completedAt:null,revision:{increment:1}},include:taskInclude}));},
    bulkComplete: async(userId,ids)=>{await ensureTaskIds(userId,ids);await prisma.task.updateMany({where:{id:{in:ids},userId,deletedAt:null},data:{status:"COMPLETED",completedAt:new Date(),revision:{increment:1}}});return(await prisma.task.findMany({where:{id:{in:ids},userId},include:taskInclude})).map(serializeTask);},
    bulkDelete: async(userId,ids)=>{await ensureTaskIds(userId,ids);await prisma.task.updateMany({where:{id:{in:ids},userId,deletedAt:null},data:{deletedAt:new Date(),revision:{increment:1}}});},
    bulkUpdate: async(userId,input)=>{await ensureTaskIds(userId,input.ids);validateRecurrence(input.recurrenceRule);const rel=await relationTargets(userId,input);const schedule=normalizeTaskSchedule(input);const data:Record<string,unknown>={revision:{increment:1}};if(input.title!==undefined)data.title=input.title;if(input.priority!==undefined)data.priority=priority(input.priority);if(input.dueDate!==undefined)data.dueDate=schedule.due.date?new Date(`${schedule.due.date}T00:00:00Z`):null;if(input.dueAt!==undefined){data.dueAt=schedule.due.at?new Date(schedule.due.at):null;if(schedule.due.at)data.dueDate=null;}if(input.reminderAt!==undefined)data.reminderAt=schedule.reminderAt?new Date(schedule.reminderAt):null;if(input.recurrenceRule!==undefined)data.recurrenceRule=input.recurrenceRule;if(rel.projectId!==undefined)data.projectId=rel.projectId;if(rel.sectionId!==undefined)data.sectionId=rel.sectionId;await prisma.$transaction(async(tx)=>{await tx.task.updateMany({where:{id:{in:input.ids},userId,deletedAt:null},data});if(input.addTagIds?.length){const existing=await tx.taskTag.findMany({where:{taskId:{in:input.ids},tagId:{in:input.addTagIds}}});const set=new Set(existing.map((x)=>`${x.taskId}:${x.tagId}`));const add=input.ids.flatMap((taskId)=>input.addTagIds!.filter((tagId)=>!set.has(`${taskId}:${tagId}`)).map((tagId)=>({taskId,tagId})));if(add.length)await tx.taskTag.createMany({data:add,skipDuplicates:true});}if(input.removeTagIds?.length)await tx.taskTag.deleteMany({where:{taskId:{in:input.ids},tagId:{in:input.removeTagIds}}});});return(await prisma.task.findMany({where:{id:{in:input.ids},userId},include:taskInclude})).map(serializeTask);},
    search: async(userId,query)=>{const ts=await prisma.task.findMany({where:{userId,deletedAt:null,OR:[{title:{contains:query,mode:"insensitive"}},{description:{contains:query,mode:"insensitive"}},{project:{name:{contains:query,mode:"insensitive"},deletedAt:null}},{tags:{some:{tag:{userId,deletedAt:null,name:{contains:query,mode:"insensitive"}}}}},{comments:{some:{deletedAt:null,body:{contains:query,mode:"insensitive"}}}}]},include:taskInclude,orderBy:[{sortOrder:"asc"},{createdAt:"desc"}]});return ts.map(serializeTask);},
    captureSnapshot: snapshot,
    restoreSnapshot,
  },
  views: {
    inbox: async(userId)=>(await prisma.task.findMany({where:{userId,deletedAt:null,status:"OPEN",projectId:null},include:taskInclude,orderBy:[{sortOrder:"asc"},{createdAt:"desc"}]})).map(serializeTask),
    today: async(userId,now,tz)=>{const b=dayBoundsInTimezone(now,tz);const d=new Date(`${b.date}T00:00:00Z`),n=new Date(`${b.nextDate}T00:00:00Z`);return(await prisma.task.findMany({where:{userId,deletedAt:null,status:"OPEN",OR:[{dueDate:{gte:d,lt:n}},{dueAt:{gte:b.start,lte:b.end}},{reminderAt:{gte:b.start,lte:b.end}}]},include:taskInclude,orderBy:[{dueDate:"asc"},{dueAt:"asc"},{sortOrder:"asc"}]})).map(serializeTask);},
    upcoming: async(userId,now,tz)=>{const b=dayBoundsInTimezone(now,tz),n=new Date(`${b.nextDate}T00:00:00Z`);return(await prisma.task.findMany({where:{userId,deletedAt:null,status:"OPEN",OR:[{dueDate:{gte:n}},{dueAt:{gt:b.end}},{reminderAt:{gt:b.end}}]},include:taskInclude,orderBy:[{dueDate:"asc"},{dueAt:"asc"},{sortOrder:"asc"}]})).map(serializeTask);},
    overdue: async(userId,now,tz)=>{const date=formatDateInTimezone(now,tz),d=new Date(`${date}T00:00:00Z`);return(await prisma.task.findMany({where:{userId,deletedAt:null,status:"OPEN",OR:[{dueDate:{lt:d}},{dueAt:{lt:now}}]},include:taskInclude,orderBy:[{dueDate:"asc"},{dueAt:"asc"}]})).map(serializeTask);},
    completed: async(userId)=>(await prisma.task.findMany({where:{userId,deletedAt:null,status:"COMPLETED"},include:taskInclude,orderBy:{completedAt:"desc"}})).map(serializeTask),
    focus: async(userId,now,tz)=>{const b=dayBoundsInTimezone(now,tz),n=new Date(`${b.nextDate}T00:00:00Z`);return(await prisma.task.findMany({where:{userId,deletedAt:null,status:"OPEN",OR:[{priority:{in:["HIGH","URGENT"]}},{dueDate:{lt:n}},{dueAt:{lte:b.end}}]},include:taskInclude,orderBy:[{priority:"desc"},{dueDate:"asc"},{dueAt:"asc"},{sortOrder:"asc"}]})).map(serializeTask);},
  },
  projects: {
    list: async(userId)=>(await prisma.project.findMany({where:{userId,deletedAt:null,status:{not:"ARCHIVED"}},orderBy:{sortOrder:"asc"}})).map(serializeProject),
    create: async(userId,input)=>serializeProject(await prisma.project.create({data:{userId,name:input.name,description:input.description??null,color:input.color??null,icon:input.icon??null}})),
    get: async(userId,id)=>serializeProject(await ensureProject(userId,id)),
    update: async(userId,id,input)=>{await ensureProject(userId,id);const data:Record<string,unknown>={};if(input.name!==undefined)data.name=input.name;if(input.description!==undefined)data.description=input.description;if(input.color!==undefined)data.color=input.color;if(input.icon!==undefined)data.icon=input.icon;if(input.status!==undefined)data.status=input.status.toUpperCase();return serializeProject(await prisma.project.update({where:{id},data}));},
    archive: async(userId,id)=>{await ensureProject(userId,id);return serializeProject(await prisma.project.update({where:{id},data:{status:"ARCHIVED",archivedAt:new Date()}}));},
    delete: async(userId,id)=>{await ensureProject(userId,id);await prisma.project.update({where:{id},data:{deletedAt:new Date()}});},
  },
  sections: {
    list: async(userId,projectId)=>{await ensureProject(userId,projectId);return(await prisma.section.findMany({where:{projectId,deletedAt:null},orderBy:{sortOrder:"asc"}})).map(serializeSection);},
    create: async(userId,input)=>{await ensureProject(userId,input.projectId);return serializeSection(await prisma.section.create({data:{projectId:input.projectId,name:input.name}}));},
    update: async(userId,projectId,id,input)=>{await ensureProject(userId,projectId);const s=await ensureSection(userId,id);if(s.projectId!==projectId)throw Errors.NotFound("Section");return serializeSection(await prisma.section.update({where:{id},data:{name:input.name,sortOrder:input.sortOrder}}));},
    delete: async(userId,projectId,id)=>{await ensureProject(userId,projectId);const s=await ensureSection(userId,id);if(s.projectId!==projectId)throw Errors.NotFound("Section");await prisma.$transaction([prisma.task.updateMany({where:{sectionId:id,userId},data:{sectionId:null}}),prisma.section.update({where:{id},data:{deletedAt:new Date()}})]);},
  },
  tags: {
    list: async(userId)=>(await prisma.tag.findMany({where:{userId,deletedAt:null},orderBy:{name:"asc"}})).map(serializeTag),
    create: async(userId,input)=>{try{return serializeTag(await prisma.tag.create({data:{userId,name:input.name,color:input.color??null}}));}catch(e){if(e instanceof Error&&e.message.includes("Unique constraint"))throw Errors.Conflict(`Tag "${input.name}" already exists.`);throw e;}},
    update: async(userId,id,input)=>{await ensureTags(userId,[id]);try{return serializeTag(await prisma.tag.update({where:{id},data:{name:input.name,color:input.color}}));}catch(e){if(e instanceof Error&&e.message.includes("Unique constraint"))throw Errors.Conflict(`Tag already exists.`);throw e;}},
    delete: async(userId,id)=>{await ensureTags(userId,[id]);await prisma.$transaction([prisma.taskTag.deleteMany({where:{tagId:id,task:{userId}}}),prisma.tag.update({where:{id},data:{deletedAt:new Date()}})]);},
    getByName: async(userId,name)=>{const t=await prisma.tag.findFirst({where:{userId,name,deletedAt:null}});return t?serializeTag(t):null;},
    verifyBelongToUser: ensureTags,
  },
  comments: {
    list: async(userId,taskId)=>{await ensureTask(userId,taskId);return(await prisma.comment.findMany({where:{taskId,userId,deletedAt:null},orderBy:{createdAt:"asc"}})).map(serializeComment);},
    create: async(userId,taskId,input)=>{await ensureTask(userId,taskId);return serializeComment(await prisma.comment.create({data:{userId,taskId,body:input.body}}));},
    update: async(userId,taskId,id,input)=>{await ensureTask(userId,taskId);const c=await prisma.comment.findFirst({where:{id,taskId,userId,deletedAt:null}});found(c,"Comment");return serializeComment(await prisma.comment.update({where:{id},data:{body:input.body}}));},
    delete: async(userId,taskId,id)=>{await ensureTask(userId,taskId);const c=await prisma.comment.findFirst({where:{id,taskId,userId,deletedAt:null}});found(c,"Comment");await prisma.comment.update({where:{id},data:{deletedAt:new Date()}});},
  },
  reminders: {
    list: async(userId,taskId)=>{await ensureTask(userId,taskId);return(await prisma.reminder.findMany({where:{userId,taskId,deletedAt:null},orderBy:{remindAt:"asc"}})).map(serializeReminder);},
    create: async(userId,taskId,input)=>{await ensureTask(userId,taskId);return serializeReminder(await prisma.reminder.create({data:{userId,taskId,remindAt:new Date(input.remindAt),channel:input.channel??"push"}}));},
    update: async(userId,id,input)=>{const r=await prisma.reminder.findFirst({where:{id,userId,deletedAt:null}});found(r,"Reminder");return serializeReminder(await prisma.reminder.update({where:{id},data:{remindAt:input.remindAt?new Date(input.remindAt):undefined,channel:input.channel,status:input.status}}));},
    delete: async(userId,id)=>{const r=await prisma.reminder.findFirst({where:{id,userId,deletedAt:null}});found(r,"Reminder");await prisma.reminder.update({where:{id},data:{deletedAt:new Date()}});},
  },
  events: {
    list: async(userId,taskId)=>{if(taskId)await ensureTask(userId,taskId,true);return(await prisma.taskEvent.findMany({where:{userId,taskId:taskId??undefined},orderBy:{createdAt:"desc"},take:100})).map(serializeTaskEvent);},
    record: async(userId,taskId,kind,payload)=>{await ensureTask(userId,taskId,true);return serializeTaskEvent(await prisma.taskEvent.create({data:{userId,taskId,kind,payload:(payload??null) as never}}));},
  },
  operations: {
    record: async(userId,kind,payload,taskId)=>serializeOperation(await prisma.operation.create({data:{userId,kind:kind as never,payload:payload as never,taskId}})),
    list: async(userId)=>(await prisma.operation.findMany({where:{userId},orderBy:{createdAt:"desc"},take:3})).map(serializeOperation),
    undoLast: async(userId)=>{const o=await prisma.operation.findFirst({where:{userId,undoneAt:null},orderBy:{createdAt:"desc"}});found(o,"Operation");return prismaRepository.operations.undo(userId,o.id);},
    undo: async(userId,id)=>{const o=await prisma.operation.findFirst({where:{id,userId}});found(o,"Operation");if(o.undoneAt)throw Errors.Conflict("Operation already undone.");const payload=o.payload as Record<string,unknown>;if(o.kind==="TASK_CREATE"){const taskId=payload.taskId as string;await ensureTask(userId,taskId,true);await prisma.task.update({where:{id:taskId},data:{deletedAt:new Date(),revision:{increment:1}}});}else if(["TASK_UPDATE","TASK_DELETE","TASK_COMPLETE","TASK_REOPEN"].includes(o.kind)){await restoreSnapshot(userId,payload as unknown as TaskSnapshot);}else if(["TASK_BULK_UPDATE","TASK_BULK_COMPLETE","TASK_BULK_DELETE","TASK_BULK_MOVE"].includes(o.kind)){for(const s of ((payload.snapshots as TaskSnapshot[])??[]))await restoreSnapshot(userId,s);}else throw Errors.Validation(`Undo not supported for operation kind: ${o.kind}`);const updated=await prisma.operation.update({where:{id},data:{undoneAt:new Date()}});return serializeOperation(updated);},
  },
};
