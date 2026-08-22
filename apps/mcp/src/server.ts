import { McpServer } from "@modelcontextprotocol/server";
import { PulseApiClient, PulseApiError, type CreateTaskInput, type Task, type UpdateTaskInput } from "@pulse/api-client";
import { z } from "zod";

export type PulseMcpApi = Pick<PulseApiClient,
  "getToday"|"getInbox"|"searchTasks"|"createTask"|"updateTask"|"completeTask"|"rescheduleTask"|"getTask"|"getUpcoming"|"getOverdue"|"reopenTask"|"cancelTask"|"moveTask"|"bulkComplete"|"bulkReschedule"|"bulkMove"|"listProjects"|"listTags"|"setTaskLabels"|"listReminders"|"createReminder"|"updateReminder"|"deleteReminder"|"createComment"|"getTaskHistory"
>;

const prioritySchema=z.enum(["none","low","medium","high","urgent"]);
const dateOnlySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Use YYYY-MM-DD");
const instantSchema=z.string().datetime({offset:true});
const reminderSchema=z.object({remindAt:instantSchema,channel:z.string().min(1).max(50).optional()});
const taskFields=z.object({
  title:z.string().trim().min(1),description:z.string().nullable().optional(),priority:prioritySchema.optional(),
  startAt:instantSchema.nullable().optional(),endAt:instantSchema.nullable().optional(),dueDate:dateOnlySchema.nullable().optional(),dueAt:instantSchema.nullable().optional(),
  recurrenceRule:z.string().nullable().optional(),projectId:z.string().nullable().optional(),parentTaskId:z.string().nullable().optional(),sortOrder:z.number().int().optional(),tagIds:z.array(z.string()).optional(),reminders:z.array(reminderSchema).max(20).optional(),
});
const createTaskSchema=taskFields;
const updateTaskSchema=taskFields.partial().extend({id:z.string().min(1)});
const taskIdSchema=z.object({id:z.string().min(1)});
const moveTaskSchema=taskIdSchema.extend({projectId:z.string().nullable()});
const bulkIdsSchema=z.object({ids:z.array(z.string().min(1)).min(1).max(1000)});
const bulkMoveSchema=bulkIdsSchema.extend({projectId:z.string().nullable()});
const bulkRescheduleSchema=bulkIdsSchema.extend({startAt:instantSchema.nullable().optional(),endAt:instantSchema.nullable().optional(),dueDate:dateOnlySchema.nullable().optional(),dueAt:instantSchema.nullable().optional()});
const rescheduleTaskSchema=z.object({id:z.string().min(1),startAt:instantSchema.nullable().optional(),endAt:instantSchema.nullable().optional(),dueDate:dateOnlySchema.nullable().optional(),dueAt:instantSchema.nullable().optional(),recurrenceRule:z.string().nullable().optional(),reminders:z.array(reminderSchema).max(20).optional()});
const commentSchema=taskIdSchema.extend({body:z.string().trim().min(1).max(10000)});
const labelsSchema=taskIdSchema.extend({tagIds:z.array(z.string()).max(100)});
const reminderIdSchema=z.object({reminderId:z.string().min(1)});
type Structured=Record<string,unknown>;

function success(data:Structured){return{content:[{type:"text" as const,text:JSON.stringify(data,null,2)}],structuredContent:data};}
function failure(error:unknown){const message=error instanceof Error?error.message:"Unknown Pulse MCP error";const code=error instanceof PulseApiError?error.code:"MCP_TOOL_ERROR";return{isError:true,content:[{type:"text" as const,text:`${code}: ${message}`}]};}
async function run(action:()=>Promise<Structured>){try{return success(await action());}catch(error){return failure(error);}}
const tasksResult=(tasks:Task[]):Structured=>({tasks});

export function createPulseMcpServer(api:PulseMcpApi):McpServer{
  const server=new McpServer({name:"pulse",version:"0.2.0"});
  server.registerTool("get_today",{description:"Get tasks scheduled/due today. Set includeCompleted=true when the user asks to see completed tasks too.",inputSchema:z.object({includeCompleted:z.boolean().optional()}),annotations:{readOnlyHint:true}},async({includeCompleted})=>run(async()=>tasksResult(await api.getToday(includeCompleted??false))));
  server.registerTool("get_inbox",{description:"Get inbox tasks. Set includeCompleted=true when requested.",inputSchema:z.object({includeCompleted:z.boolean().optional()}),annotations:{readOnlyHint:true}},async({includeCompleted})=>run(async()=>tasksResult(await api.getInbox(includeCompleted??false))));
  server.registerTool("search_tasks",{description:"Search Pulse tasks by text.",inputSchema:z.object({query:z.string().trim().min(1)}),annotations:{readOnlyHint:true}},async({query})=>run(async()=>tasksResult(await api.searchTasks(query))));
  server.registerTool("create_task",{description:"Create a fully structured Pulse task. Interpret the user's natural language yourself before calling this tool. Use startAt/endAt for a scheduled time window, dueDate/dueAt only for a deadline, projectId for a project, tagIds for labels, priority none/low/medium/high/urgent, reminders for zero or more reminder instants, and recurrenceRule for recurring tasks. Date-only deadlines must use dueDate.",inputSchema:createTaskSchema},async(input)=>run(async()=>({task:await api.createTask(input as CreateTaskInput)})));
  server.registerTool("update_task",{description:"Update any structured task fields. Do not pass fields the user did not ask to change.",inputSchema:updateTaskSchema},async({id,...input})=>run(async()=>({task:await api.updateTask(id,input as UpdateTaskInput)})));
  server.registerTool("complete_task",{description:"Complete a task. For recurring tasks Pulse automatically creates the next anchored occurrence and skips already-missed occurrences.",inputSchema:taskIdSchema},async({id})=>run(async()=>({task:await api.completeTask(id)})));
  server.registerTool("reschedule_task",{description:"Change schedule start/end, deadline, recurrence, or the complete reminder set for a task.",inputSchema:rescheduleTaskSchema},async({id,...input})=>run(async()=>({task:await api.rescheduleTask(id,input)})));
  server.registerTool("get_task",{description:"Get one Pulse task by id, including labels and all reminders.",inputSchema:taskIdSchema,annotations:{readOnlyHint:true}},async({id})=>run(async()=>({task:await api.getTask(id)})));
  server.registerTool("get_upcoming",{description:"Get upcoming tasks. Set includeCompleted=true when requested.",inputSchema:z.object({includeCompleted:z.boolean().optional()}),annotations:{readOnlyHint:true}},async({includeCompleted})=>run(async()=>tasksResult(await api.getUpcoming(includeCompleted??false))));
  server.registerTool("get_overdue",{description:"Get overdue open Pulse tasks.",inputSchema:z.object({}),annotations:{readOnlyHint:true}},async()=>run(async()=>tasksResult(await api.getOverdue())));
  server.registerTool("reopen_task",{description:"Reopen a completed Pulse task.",inputSchema:taskIdSchema},async({id})=>run(async()=>({task:await api.reopenTask(id)})));
  server.registerTool("cancel_task",{description:"Cancel a Pulse task without hard deleting it.",inputSchema:taskIdSchema},async({id})=>run(async()=>({task:await api.cancelTask(id)})));
  server.registerTool("move_task",{description:"Move a Pulse task to a project or Inbox (projectId=null).",inputSchema:moveTaskSchema},async({id,projectId})=>run(async()=>({task:await api.moveTask(id,{projectId})})));
  server.registerTool("bulk_complete_tasks",{description:"Complete multiple tasks as one logical operation.",inputSchema:bulkIdsSchema},async({ids})=>run(async()=>tasksResult(await api.bulkComplete({ids}))));
  server.registerTool("bulk_reschedule_tasks",{description:"Change schedule/deadline fields on multiple tasks.",inputSchema:bulkRescheduleSchema},async({ids,...schedule})=>run(async()=>tasksResult(await api.bulkReschedule({ids,...schedule}))));
  server.registerTool("bulk_move_tasks",{description:"Move multiple tasks to a project or Inbox.",inputSchema:bulkMoveSchema},async({ids,projectId})=>run(async()=>tasksResult(await api.bulkMove({ids,projectId}))));
  server.registerTool("get_projects",{description:"List Pulse projects so project names can be resolved to projectId.",inputSchema:z.object({}),annotations:{readOnlyHint:true}},async()=>run(async()=>({projects:await api.listProjects()})));
  server.registerTool("get_labels",{description:"List Pulse labels so @label names can be resolved to tagIds.",inputSchema:z.object({}),annotations:{readOnlyHint:true}},async()=>run(async()=>({labels:await api.listTags()})));
  server.registerTool("set_task_labels",{description:"Replace the labels on a task with the supplied tagIds.",inputSchema:labelsSchema},async({id,tagIds})=>run(async()=>({task:await api.setTaskLabels(id,tagIds)})));
  server.registerTool("get_task_reminders",{description:"List every reminder attached to a task.",inputSchema:taskIdSchema,annotations:{readOnlyHint:true}},async({id})=>run(async()=>({reminders:await api.listReminders(id)})));
  server.registerTool("add_task_reminder",{description:"Add one reminder to a task. The default channel is Hermes Telegram.",inputSchema:taskIdSchema.merge(reminderSchema)},async({id,remindAt,channel})=>run(async()=>({reminder:await api.createReminder(id,{remindAt,channel})})));
  server.registerTool("update_task_reminder",{description:"Change an existing reminder.",inputSchema:reminderIdSchema.extend({remindAt:instantSchema.optional(),channel:z.string().min(1).max(50).optional(),status:z.string().optional()})},async({reminderId,...input})=>run(async()=>({reminder:await api.updateReminder(reminderId,input)})));
  server.registerTool("delete_task_reminder",{description:"Remove an existing reminder.",inputSchema:reminderIdSchema},async({reminderId})=>run(async()=>{await api.deleteReminder(reminderId);return{deleted:true};}));
  server.registerTool("add_comment",{description:"Add a comment to a Pulse task.",inputSchema:commentSchema},async({id,body})=>run(async()=>({comment:await api.createComment(id,{body})})));
  server.registerTool("get_task_activity",{description:"Get activity history for a Pulse task.",inputSchema:taskIdSchema,annotations:{readOnlyHint:true}},async({id})=>run(async()=>({events:await api.getTaskHistory(id)})));
  return server;
}

export function createDefaultPulseApi():PulseApiClient{const baseUrl=process.env.PULSE_API_BASE_URL??"http://127.0.0.1:4000";const token=process.env.PULSE_API_TOKEN??null;return new PulseApiClient({baseUrl,getAccessToken:token?async()=>token:undefined});}
