import type { Prisma } from "@pulse/db";
import type { Comment, Operation, Priority, Project, ProjectStatus, Reminder, Section, Tag, Task, TaskEvent, TaskStatus } from "@pulse/domain";

type TaskWithRelations = {
  id: string; userId: string; projectId: string | null; sectionId: string | null; parentTaskId: string | null;
  title: string; description: string | null; status: string; priority: string; dueDate: Date | null; dueAt: Date | null; reminderAt: Date | null; recurrenceRule: string | null; completedAt: Date | null; deletedAt: Date | null; sortOrder: number; revision: number; createdAt: Date; updatedAt: Date;
  tags: { tag: { id: string; userId: string; name: string; color: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null } }[];
};

export function serializeTaskStatus(status: string): TaskStatus {
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "open";
}
export function serializePriority(priority: string): Priority {
  switch (priority) { case "LOW": return "low"; case "MEDIUM": return "medium"; case "HIGH": return "high"; case "URGENT": return "urgent"; default: return "none"; }
}
export function serializeTag(tag: { id: string; userId: string; name: string; color: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }): Tag {
  return { id: tag.id, userId: tag.userId, name: tag.name, color: tag.color, createdAt: tag.createdAt.toISOString(), updatedAt: tag.updatedAt.toISOString(), deletedAt: tag.deletedAt?.toISOString() ?? null };
}
export function serializeTask(task: TaskWithRelations): Task {
  return { id: task.id, userId: task.userId, title: task.title, description: task.description, status: serializeTaskStatus(task.status), priority: serializePriority(task.priority), due: { date: task.dueDate?.toISOString().slice(0, 10) ?? null, at: task.dueAt?.toISOString() ?? null }, reminderAt: task.reminderAt?.toISOString() ?? null, recurrenceRule: task.recurrenceRule, completedAt: task.completedAt?.toISOString() ?? null, deletedAt: task.deletedAt?.toISOString() ?? null, projectId: task.projectId, sectionId: task.sectionId, parentTaskId: task.parentTaskId, sortOrder: task.sortOrder, revision: task.revision, tags: task.tags.map((t) => serializeTag(t.tag)).filter((t) => !t.deletedAt), createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() };
}
export function serializeProjectStatus(status: string): ProjectStatus { return status === "ARCHIVED" ? "archived" : status === "COMPLETED" ? "completed" : "active"; }
export function serializeProject(project: Prisma.ProjectGetPayload<{}>): Project {
  return { id: project.id, userId: project.userId, name: project.name, description: project.description, color: project.color, icon: project.icon, status: serializeProjectStatus(project.status), sortOrder: project.sortOrder, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(), archivedAt: project.archivedAt?.toISOString() ?? null, deletedAt: project.deletedAt?.toISOString() ?? null };
}
export function serializeSection(section: Prisma.SectionGetPayload<{}>): Section {
  return { id: section.id, projectId: section.projectId, name: section.name, sortOrder: section.sortOrder, createdAt: section.createdAt.toISOString(), updatedAt: section.updatedAt.toISOString(), deletedAt: section.deletedAt?.toISOString() ?? null };
}
export function serializeComment(comment: Prisma.CommentGetPayload<{}>): Comment {
  return { id: comment.id, taskId: comment.taskId, userId: comment.userId, body: comment.body, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString(), deletedAt: comment.deletedAt?.toISOString() ?? null };
}
export function serializeReminder(reminder: Prisma.ReminderGetPayload<{}>): Reminder {
  return { id: reminder.id, taskId: reminder.taskId, userId: reminder.userId, remindAt: reminder.remindAt.toISOString(), channel: reminder.channel, status: reminder.status, createdAt: reminder.createdAt.toISOString(), updatedAt: reminder.updatedAt.toISOString(), deletedAt: reminder.deletedAt?.toISOString() ?? null };
}
export function serializeTaskEvent(event: Prisma.TaskEventGetPayload<{}>): TaskEvent {
  return { id: event.id, taskId: event.taskId, userId: event.userId, kind: event.kind, payload: event.payload as unknown, createdAt: event.createdAt.toISOString() };
}
export function serializeOperation(operation: Prisma.OperationGetPayload<{}>): Operation {
  return { id: operation.id, userId: operation.userId, kind: operation.kind, payload: operation.payload as unknown, undoneAt: operation.undoneAt?.toISOString() ?? null, createdAt: operation.createdAt.toISOString() };
}
