import { getRepository } from "../repositories/registry.js";
import type { Tag, UserId } from "@pulse/domain";
import type { CreateTagInput, UpdateTagInput } from "@pulse/api-client";
export const listTags=(u:UserId):Promise<Tag[]>=>getRepository().tags.list(u);
export const createTag=(u:UserId,i:CreateTagInput):Promise<Tag>=>getRepository().tags.create(u,i);
export const updateTag=(u:UserId,id:string,i:UpdateTagInput):Promise<Tag>=>getRepository().tags.update(u,id,i);
export const deleteTag=(u:UserId,id:string):Promise<void>=>getRepository().tags.delete(u,id);
export const getTagByName=(u:UserId,n:string):Promise<Tag|null>=>getRepository().tags.getByName(u,n);
