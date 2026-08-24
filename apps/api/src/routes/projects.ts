import { z } from "zod";
import { getUser } from "../lib/auth.js";
import { parseBody, parseParams, ProjectStatusSchema } from "../lib/validation.js";
import * as service from "../services/project-service.js";
import type { FastifyInstance } from "fastify";
const Id=z.object({id:z.string().min(1)});
const Create=z.object({name:z.string().min(1).max(200),description:z.string().max(5000).nullable().optional(),color:z.string().max(50).nullable().optional(),icon:z.string().max(50).nullable().optional()});
const Update=Create.partial().extend({status:ProjectStatusSchema.optional()});
export default async function projectRoutes(app:FastifyInstance){
 app.get("/",async(r,p)=>{const u=getUser(r);p.send(await service.listProjects(u.id));});
 app.post("/",async(r,p)=>{const u=getUser(r);p.status(201).send(await service.createProject(u.id,parseBody(Create,r.body)));});
 app.get("/:id",async(r,p)=>{const u=getUser(r);const {id}=parseParams(Id,r.params);p.send(await service.getProject(u.id,id));});
 app.patch("/:id",async(r,p)=>{const u=getUser(r);const {id}=parseParams(Id,r.params);p.send(await service.updateProject(u.id,id,parseBody(Update,r.body)));});
 app.post("/:id/archive",async(r,p)=>{const u=getUser(r);const {id}=parseParams(Id,r.params);p.send(await service.archiveProject(u.id,id));});
 app.delete("/:id",async(r,p)=>{const u=getUser(r);const {id}=parseParams(Id,r.params);await service.deleteProject(u.id,id);p.status(204).send();});
}
