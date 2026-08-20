import { getRepository } from "../repositories/registry.js";
import type { Reminder, UserId } from "@pulse/domain";
import type { CreateReminderInput, UpdateReminderInput } from "@pulse/api-client";
export const listReminders=(u:UserId,t:string):Promise<Reminder[]>=>getRepository().reminders.list(u,t);
export const createReminder=(u:UserId,t:string,i:CreateReminderInput):Promise<Reminder>=>getRepository().reminders.create(u,t,i);
export const updateReminder=(u:UserId,id:string,i:UpdateReminderInput):Promise<Reminder>=>getRepository().reminders.update(u,id,i);
export const deleteReminder=(u:UserId,id:string):Promise<void>=>getRepository().reminders.delete(u,id);
