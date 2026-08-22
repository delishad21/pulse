import type { Prisma } from "@pulse/db";
import type { Comment, Operation, Priority, Project, ProjectStatus, Reminder, Tag, Task, TaskEvent, TaskStatus } from "@pulse/domain";

type ReminderRow = { id:string; taskId:string; userId:string; remindAt:Date; channel:string; status:string; createdAt:Date; updatedAt:Date; deletedAt:Date|null };
type TaskWithRelations = {
  id:string; userId:string; projectId:string|null; parentTaskId:string|null; title:string; description:string|null; status:string; priority:string;
  startAt:Date|null; endAt:Date|null; dueDate:Date|null; dueAt:Date|null; recurrenceRule:string|null; completedAt:Date|null; deletedAt:Date|null; sortOrder:number; revision:number; createdAt:Date; updatedAt:Date;
  tags:{tag:{id:string; userId:string; name:string; color:string|null; createdAt:Date; updatedAt:Date; deletedAt:Date|null}}[]; reminders:ReminderRow[];
};

export function serializeTaskStatus(status:string):TaskStatus { return status === "COMPLETED" ? "completed" : status === "CANCELLED" ? "cancelled" : "open"; }
export function serializePriority(priority:string):Priority { return priority === "LOW" ? "low" : priority === "MEDIUM" ? "medium" : priority === "HIGH" ? "high" : priority === "URGENT" ? "urgent" : "none"; }
export function serializeTag(tag:{id:string; userId:string; name:string; color:string|null; createdAt:Date; updatedAt:Date; deletedAt:Date|null}):Tag { return {id:tag.id,userId:tag.userId,name:tag.name,color:tag.color,createdAt:tag.createdAt.toISOString(),updatedAt:tag.updatedAt.toISOString(),deletedAt:tag.deletedAt?.toISOString()??null}; }
export function serializeReminder(reminder:ReminderRow):Reminder { return {id:reminder.id,taskId:reminder.taskId,userId:reminder.userId,remindAt:reminder.remindAt.toISOString(),channel:reminder.channel,status:reminder.status,createdAt:reminder.createdAt.toISOString(),updatedAt:reminder.updatedAt.toISOString(),deletedAt:reminder.deletedAt?.toISOString()??null}; }
export function serializeTask(task:TaskWithRelations):Task {
  return { id:task.id,userId:task.userId,title:task.title,description:task.description,status:serializeTaskStatus(task.status),priority:serializePriority(task.priority),startAt:task.startAt?.toISOString()??null,endAt:task.endAt?.toISOString()??null,due:{date:task.dueDate?.toISOString().slice(0,10)??null,at:task.dueAt?.toISOString()??null},recurrenceRule:task.recurrenceRule,completedAt:task.completedAt?.toISOString()??null,deletedAt:task.deletedAt?.toISOString()??null,projectId:task.projectId,parentTaskId:task.parentTaskId,sortOrder:task.sortOrder,revision:task.revision,tags:task.tags.map((t)=>serializeTag(t.tag)).filter((t)=>!t.deletedAt),reminders:task.reminders.map(serializeReminder).filter((r)=>!r.deletedAt),createdAt:task.createdAt.toISOString(),updatedAt:task.updatedAt.toISOString() };
}
export function serializeProjectStatus(status:string):ProjectStatus { return status === "ARCHIVED" ? "archived" : status === "COMPLETED" ? "completed" : "active"; }
export function serializeProject(project:Prisma.ProjectGetPayload<{}>):Project { return {id:project.id,userId:project.userId,name:project.name,description:project.description,color:project.color,icon:project.icon,status:serializeProjectStatus(project.status),sortOrder:project.sortOrder,createdAt:project.createdAt.toISOString(),updatedAt:project.updatedAt.toISOString(),archivedAt:project.archivedAt?.toISOString()??null,deletedAt:project.deletedAt?.toISOString()??null}; }
export function serializeComment(comment:Prisma.CommentGetPayload<{}>):Comment { return {id:comment.id,taskId:comment.taskId,userId:comment.userId,body:comment.body,createdAt:comment.createdAt.toISOString(),updatedAt:comment.updatedAt.toISOString(),deletedAt:comment.deletedAt?.toISOString()??null}; }
export function serializeTaskEvent(event:Prisma.TaskEventGetPayload<{}>):TaskEvent { return {id:event.id,taskId:event.taskId,userId:event.userId,kind:event.kind,payload:event.payload as unknown,createdAt:event.createdAt.toISOString()}; }
export function serializeOperation(operation:Prisma.OperationGetPayload<{}>):Operation { return {id:operation.id,userId:operation.userId,kind:operation.kind,payload:operation.payload as unknown,undoneAt:operation.undoneAt?.toISOString()??null,createdAt:operation.createdAt.toISOString()}; }
