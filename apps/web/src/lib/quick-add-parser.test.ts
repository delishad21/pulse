import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickAdd, parseQuickAddDetailed } from "./quick-add-parser.ts";
const now=new Date(2026,7,22,14,0,0);
const projects=[{id:"p1",userId:"u",name:"Work",description:null,color:null,icon:null,status:"active" as const,sortOrder:0,createdAt:"",updatedAt:"",archivedAt:null,deletedAt:null},{id:"p2",userId:"u",name:"Personal Projects",description:null,color:"#3b82f6",icon:null,status:"active" as const,sortOrder:1,createdAt:"",updatedAt:"",archivedAt:null,deletedAt:null}];
const tags=[{id:"t1",userId:"u",name:"finance",color:null,createdAt:"",updatedAt:"",deletedAt:null},{id:"t2",userId:"u",name:"CS3219(TA)",color:"#2563eb",createdAt:"",updatedAt:"",deletedAt:null}];
test("parses weekdays and recurring weekdays",()=>{assert.equal(parseQuickAdd("Review Thursday",{now}).dueDate,"2026-08-27");assert.equal(parseQuickAdd("Gym every Thursday",{now}).recurrenceRule,"FREQ=WEEKLY;BYDAY=TH");assert.equal(parseQuickAdd("Gym every Thursday",{now}).dueDate,"2026-08-27");});
test("single times become scheduled starts and ranges become start/end",()=>{const one=parseQuickAdd("Call Thursday at 3:30pm",{now});assert.equal(one.startAt,new Date(2026,7,27,15,30).toISOString());assert.equal(one.dueDate,undefined);const range=parseQuickAdd("Workshop tomorrow 2pm-4pm",{now});assert.equal(range.startAt,new Date(2026,7,23,14,0).toISOString());assert.equal(range.endAt,new Date(2026,7,23,16,0).toISOString());});
test("supports day intervals, biweekly and monthly recurrence",()=>{assert.equal(parseQuickAdd("Filters every 10 days",{now}).recurrenceRule,"FREQ=DAILY;INTERVAL=10");assert.equal(parseQuickAdd("Review biweekly",{now}).recurrenceRule,"FREQ=WEEKLY;INTERVAL=2");assert.equal(parseQuickAdd("Budget every month",{now}).recurrenceRule,"FREQ=MONTHLY");});
test("uses # for projects, @ for labels, and ^ for priority",()=>{const task=parseQuickAdd("Submit #Work @finance ^urgent tomorrow",{now,projects,tags});assert.equal(task.title,"Submit");assert.equal(task.projectId,"p1");assert.deepEqual(task.tagIds,["t1"]);assert.equal(task.priority,"urgent");assert.equal(task.dueDate,"2026-08-23");});
test("detected token can be suppressed without deleting its literal text",()=>{const first=parseQuickAddDetailed("Pay @finance tomorrow",{now,tags});const label=first.tokens.find((t)=>t.type==="label")!;const second=parseQuickAddDetailed("Pay @finance tomorrow",{now,tags,ignoredTokenIds:new Set([label.id])});assert.deepEqual(second.input.tagIds,undefined);assert.equal(second.input.title,"Pay @finance");});

test("supports location tokens and quoted multi-word locations",()=>{
  const simple=parseQuickAdd("Buy milk *Home",{now});
  assert.equal(simple.location,"Home"); assert.equal(simple.title,"Buy milk");
  const quoted=parseQuickAdd('Dinner *"Marina Bay" tomorrow',{now});
  assert.equal(quoted.location,"Marina Bay"); assert.equal(quoted.title,"Dinner"); assert.equal(quoted.dueDate,"2026-08-23");
});
test("matches stored project and label names containing spaces or punctuation",()=>{
  const task=parseQuickAdd("Prepare tutorial #Personal Projects @CS3219(TA) ^high",{now,projects,tags});
  assert.equal(task.projectId,"p2"); assert.deepEqual(task.tagIds,["t2"]); assert.equal(task.priority,"high"); assert.equal(task.title,"Prepare tutorial");
});
