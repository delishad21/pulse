import { getUser } from "../lib/auth.js";
import { getRepository } from "../repositories/registry.js";
import type { FastifyInstance } from "fastify";
function includeCompleted(query:unknown):boolean{return (query as {includeCompleted?:string})?.includeCompleted==="true";}
export default async function viewRoutes(app:FastifyInstance){
  app.get("/inbox",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.inbox(u.id,includeCompleted(r.query)));});
  app.get("/today",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.today(u.id,new Date(),u.timezone,includeCompleted(r.query)));});
  app.get("/upcoming",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.upcoming(u.id,new Date(),u.timezone,includeCompleted(r.query)));});
  app.get("/overdue",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.overdue(u.id,new Date(),u.timezone));});
  app.get("/completed",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.completed(u.id));});
  app.get("/focus",async(r,p)=>{const u=getUser(r);p.send(await getRepository().views.focus(u.id,new Date(),u.timezone));});
}
