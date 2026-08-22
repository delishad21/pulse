import { z } from "zod";
import { getUser } from "../lib/auth.js";
import { parseBody, parseParams, PrioritySchema, ISODateSchema, ISOInstantSchema } from "../lib/validation.js";
import * as taskService from "../services/task-service.js";
import * as operationService from "../services/operation-service.js";
import * as eventService from "../services/event-service.js";
import type { BulkUpdateInput, UpdateTaskInput } from "@pulse/api-client";
import type { FastifyInstance } from "fastify";

const IdParam=z.object({id:z.string().min(1)});
const Recurrence=z.string().max(1000).nullable().optional();
const ReminderInput=z.object({remindAt:ISOInstantSchema,channel:z.string().min(1).max(50).optional()});
const TaskFields=z.object({
  title:z.string().min(1).max(500),description:z.string().max(10000).nullable().optional(),priority:PrioritySchema.optional(),
  startAt:ISOInstantSchema.nullable().optional(),endAt:ISOInstantSchema.nullable().optional(),dueDate:ISODateSchema.nullable().optional(),dueAt:ISOInstantSchema.nullable().optional(),
  recurrenceRule:Recurrence,projectId:z.string().nullable().optional(),parentTaskId:z.string().nullable().optional(),sortOrder:z.number().int().min(0).optional(),tagIds:z.array(z.string()).max(100).optional(),reminders:z.array(ReminderInput).max(20).optional(),
});
const CreateTaskSchema=TaskFields;
const UpdateTaskSchema=TaskFields.partial();
const BulkIds=z.object({ids:z.array(z.string()).min(1).max(1000)});
const BulkReorder=z.object({updates:z.array(z.object({id:z.string(),sortOrder:z.number().int().min(0)})).min(1).max(1000)});
const BulkUpdate=BulkIds.extend({title:z.string().min(1).max(500).optional(),priority:PrioritySchema.optional(),startAt:ISOInstantSchema.nullable().optional(),endAt:ISOInstantSchema.nullable().optional(),dueDate:ISODateSchema.nullable().optional(),dueAt:ISOInstantSchema.nullable().optional(),recurrenceRule:Recurrence,projectId:z.string().nullable().optional(),addTagIds:z.array(z.string()).optional(),removeTagIds:z.array(z.string()).optional()});
const MoveSchema=z.object({projectId:z.string().nullable()});
const ScheduleSchema=z.object({startAt:ISOInstantSchema.nullable().optional(),endAt:ISOInstantSchema.nullable().optional(),dueDate:ISODateSchema.nullable().optional(),dueAt:ISOInstantSchema.nullable().optional(),recurrenceRule:Recurrence,reminders:z.array(ReminderInput).max(20).optional()});
const LabelsSchema=z.object({tagIds:z.array(z.string()).max(100)});

async function snapshotAndUpdate(userId:string,id:string,input:UpdateTaskInput,kind:string){const snap=await operationService.captureSnapshot(userId,id);const task=await taskService.updateTask(userId,id,input);await operationService.recordOperation(userId,"TASK_UPDATE",snap,id);await eventService.recordEvent(userId,id,kind,input);return task;}

export default async function taskRoutes(app:FastifyInstance):Promise<void>{
  app.get("/",async(req,reply)=>{const u=getUser(req);reply.send(await taskService.listTasks(u.id,req.query as Record<string,string>));});
  app.post("/",async(req,reply)=>{const u=getUser(req);const input=parseBody<z.infer<typeof CreateTaskSchema>>(CreateTaskSchema,req.body);const task=await taskService.createTask(u.id,input);await operationService.recordOperation(u.id,"TASK_CREATE",{taskId:task.id},task.id);await eventService.recordEvent(u.id,task.id,"task.created",input);reply.status(201).send(task);});
  app.post("/bulk/complete",async(req,reply)=>{const u=getUser(req);const {ids}=parseBody<{ids:string[]}>(BulkIds,req.body);const snapshots=await operationService.captureSnapshots(u.id,ids);const result=await taskService.bulkComplete(u.id,ids,u.timezone);await operationService.recordOperation(u.id,"TASK_BULK_COMPLETE",{snapshots,spawnedTaskIds:result.spawnedTasks.map((task)=>task.id)});await Promise.all(result.tasks.map((task)=>eventService.recordEvent(u.id,task.id,"task.completed")));await Promise.all(result.spawnedTasks.map((task)=>eventService.recordEvent(u.id,task.id,"task.recurrence_created")));reply.send(result.tasks);});
  app.post("/bulk/delete",async(req,reply)=>{const u=getUser(req);const {ids}=parseBody<{ids:string[]}>(BulkIds,req.body);const snapshots=await operationService.captureSnapshots(u.id,ids);await taskService.bulkDelete(u.id,ids);await operationService.recordOperation(u.id,"TASK_BULK_DELETE",{snapshots});await Promise.all(ids.map((id)=>eventService.recordEvent(u.id,id,"task.deleted")));reply.status(204).send();});
  app.post("/bulk/update",async(req,reply)=>{const u=getUser(req);const input=parseBody<BulkUpdateInput>(BulkUpdate,req.body);const snapshots=await operationService.captureSnapshots(u.id,input.ids);const tasks=await taskService.bulkUpdate(u.id,input);await operationService.recordOperation(u.id,"TASK_BULK_UPDATE",{snapshots});await Promise.all(input.ids.map((id)=>eventService.recordEvent(u.id,id,"task.updated",input)));reply.send(tasks);});
  app.post("/bulk/move",async(req,reply)=>{const u=getUser(req);const input=parseBody<{ids:string[];projectId:string|null}>(BulkIds.merge(MoveSchema),req.body);const snapshots=await operationService.captureSnapshots(u.id,input.ids);const tasks=await taskService.bulkUpdate(u.id,input);await operationService.recordOperation(u.id,"TASK_BULK_MOVE",{snapshots});await Promise.all(input.ids.map((id)=>eventService.recordEvent(u.id,id,"task.moved",input)));reply.send(tasks);});
  app.post("/bulk/reschedule",async(req,reply)=>{const u=getUser(req);const input=parseBody<BulkUpdateInput>(BulkIds.merge(ScheduleSchema.omit({reminders:true})),req.body);const snapshots=await operationService.captureSnapshots(u.id,input.ids);const tasks=await taskService.bulkUpdate(u.id,input);await operationService.recordOperation(u.id,"TASK_BULK_UPDATE",{snapshots});await Promise.all(input.ids.map((id)=>eventService.recordEvent(u.id,id,"task.rescheduled",input)));reply.send(tasks);});
  app.post("/bulk/reorder",async(req,reply)=>{const u=getUser(req);const {updates}=parseBody<{updates:Array<{id:string;sortOrder:number}>}>(BulkReorder,req.body);const ids=updates.map((item)=>item.id);const snapshots=await operationService.captureSnapshots(u.id,ids);const tasks=await Promise.all(updates.map((item)=>taskService.updateTask(u.id,item.id,{sortOrder:item.sortOrder})));await operationService.recordOperation(u.id,"TASK_BULK_UPDATE",{snapshots});await Promise.all(updates.map((item)=>eventService.recordEvent(u.id,item.id,"task.reordered",{sortOrder:item.sortOrder})));reply.send(tasks);});
  app.get("/:id",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);reply.send(await taskService.getTask(u.id,id));});
  app.patch("/:id",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const input=parseBody<UpdateTaskInput>(UpdateTaskSchema,req.body);reply.send(await snapshotAndUpdate(u.id,id,input,"task.updated"));});
  app.delete("/:id",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const snap=await operationService.captureSnapshot(u.id,id);await taskService.deleteTask(u.id,id);await operationService.recordOperation(u.id,"TASK_DELETE",snap,id);await eventService.recordEvent(u.id,id,"task.deleted");reply.status(204).send();});
  app.post("/:id/complete",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const snap=await operationService.captureSnapshot(u.id,id);const result=await taskService.completeTask(u.id,id,u.timezone);await operationService.recordOperation(u.id,"TASK_COMPLETE",{snapshot:snap,spawnedTaskIds:result.spawnedTask?[result.spawnedTask.id]:[]},id);await eventService.recordEvent(u.id,id,"task.completed");if(result.spawnedTask)await eventService.recordEvent(u.id,result.spawnedTask.id,"task.recurrence_created",{fromTaskId:id});reply.send(result.task);});
  app.post("/:id/reopen",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const snap=await operationService.captureSnapshot(u.id,id);const task=await taskService.reopenTask(u.id,id);await operationService.recordOperation(u.id,"TASK_REOPEN",snap,id);await eventService.recordEvent(u.id,id,"task.reopened");reply.send(task);});
  app.post("/:id/cancel",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const snap=await operationService.captureSnapshot(u.id,id);const task=await taskService.cancelTask(u.id,id);await operationService.recordOperation(u.id,"TASK_UPDATE",snap,id);await eventService.recordEvent(u.id,id,"task.cancelled");reply.send(task);});
  app.post("/:id/move",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const input=parseBody<UpdateTaskInput>(MoveSchema,req.body);reply.send(await snapshotAndUpdate(u.id,id,input,"task.moved"));});
  app.post("/:id/reschedule",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const input=parseBody<UpdateTaskInput>(ScheduleSchema,req.body);reply.send(await snapshotAndUpdate(u.id,id,input,"task.rescheduled"));});
  app.post("/:id/labels",async(req,reply)=>{const u=getUser(req);const {id}=parseParams(IdParam,req.params);const {tagIds}=parseBody<{tagIds:string[]}>(LabelsSchema,req.body);reply.send(await snapshotAndUpdate(u.id,id,{tagIds},"task.labels_changed"));});
}
