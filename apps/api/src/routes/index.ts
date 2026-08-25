import type { FastifyInstance } from "fastify";
import healthRoutes from "./health.js"; import taskRoutes from "./tasks.js"; import projectRoutes from "./projects.js"; import tagRoutes from "./tags.js"; import commentRoutes from "./comments.js"; import viewRoutes from "./views.js"; import searchRoutes from "./search.js"; import operationRoutes from "./operations.js"; import taskReminderRoutes from "./task-reminders.js"; import reminderRoutes from "./reminders.js"; import activityRoutes from "./activity.js"; import historyRoutes from "./history.js"; import apiKeyRoutes from "./api-keys.js";
import notificationPreferenceRoutes from "./notification-preferences.js";
import pushDeviceRoutes from "./push-devices.js";
export async function registerRoutes(app:FastifyInstance):Promise<void>{
 await app.register(healthRoutes,{prefix:"/api/health"});
 await app.register(commentRoutes,{prefix:"/api/tasks/:taskId/comments"});
 await app.register(taskReminderRoutes,{prefix:"/api/tasks/:taskId/reminders"});
 await app.register(historyRoutes,{prefix:"/api/tasks/:taskId/history"});
 await app.register(taskRoutes,{prefix:"/api/tasks"});
 await app.register(projectRoutes,{prefix:"/api/projects"});
 await app.register(tagRoutes,{prefix:"/api/tags"});
 await app.register(reminderRoutes,{prefix:"/api/reminders"});
 await app.register(viewRoutes,{prefix:"/api/views"});
 await app.register(searchRoutes,{prefix:"/api/search"});
 await app.register(operationRoutes,{prefix:"/api/operations"});
 await app.register(activityRoutes,{prefix:"/api/activity"});
 await app.register(apiKeyRoutes,{prefix:"/api/api-keys"});
 await app.register(notificationPreferenceRoutes,{prefix:"/api/notification-preferences"});
 await app.register(pushDeviceRoutes,{prefix:"/api/push-devices"});
}
