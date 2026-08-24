import { getRepository } from "../repositories/registry.js";
import type { Comment, UserId } from "@pulse/domain";
import type { CreateCommentInput, UpdateCommentInput } from "@pulse/api-client";
export const listComments=(u:UserId,t:string):Promise<Comment[]>=>getRepository().comments.list(u,t);
export const createComment=(u:UserId,t:string,i:CreateCommentInput):Promise<Comment>=>getRepository().comments.create(u,t,i);
export const updateComment=(u:UserId,t:string,id:string,i:UpdateCommentInput):Promise<Comment>=>getRepository().comments.update(u,t,id,i);
export const deleteComment=(u:UserId,t:string,id:string):Promise<void>=>getRepository().comments.delete(u,t,id);
