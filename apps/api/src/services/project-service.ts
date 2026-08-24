import { getRepository } from "../repositories/registry.js";
import type { Project, UserId } from "@pulse/domain";
import type { CreateProjectInput, UpdateProjectInput } from "@pulse/api-client";
export const listProjects=(u:UserId):Promise<Project[]>=>getRepository().projects.list(u);
export const createProject=(u:UserId,i:CreateProjectInput):Promise<Project>=>getRepository().projects.create(u,i);
export const getProject=(u:UserId,id:string):Promise<Project>=>getRepository().projects.get(u,id);
export const updateProject=(u:UserId,id:string,i:UpdateProjectInput):Promise<Project>=>getRepository().projects.update(u,id,i);
export const archiveProject=(u:UserId,id:string):Promise<Project>=>getRepository().projects.archive(u,id);
export const deleteProject=(u:UserId,id:string):Promise<void>=>getRepository().projects.delete(u,id);
