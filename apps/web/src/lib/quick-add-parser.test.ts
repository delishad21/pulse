import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickAdd, parseQuickAddDetailed } from "./quick-add-parser.ts";
const now=new Date(2026,7,22,14,0,0);
const projects=[{id:"p1",userId:"u",name:"Work",description:null,color:null,icon:null,status:"active" as const,sortOrder:0,createdAt:"",updatedAt:"",archivedAt:null,deletedAt:null},{id:"p2",userId:"u",name:"Personal Projects",description:null,color:"#3b82f6",icon:null,status:"active" as const,sortOrder:1,createdAt:"",updatedAt:"",archivedAt:null,deletedAt:null}];
const tags=[{id:"t1",userId:"u",name:"finance",color:null,createdAt:"",updatedAt:"",deletedAt:null},{id:"t2",userId:"u",name:"CS3219(TA)",color:"#2563eb",createdAt:"",updatedAt:"",deletedAt:null}];
function assertExactRanges(source:string){
  const tokens=parseQuickAddDetailed(source,{now,projects,tags}).tokens;
  let end=0;
  for(const token of tokens){
    assert.ok(token.start>=end,`overlapping token at ${token.start}: ${token.text}`);
    assert.equal(source.slice(token.start,token.end),token.text,`range mismatch for ${token.text}`);
    assert.ok(token.end<=source.length,`out-of-bounds token: ${token.text}`);
    end=token.end;
  }
  return tokens;
}
test("parses abbreviated, full, and this-week weekdays consistently",()=>{
  for(const phrase of ["wed","wednesday","this wed","this wednesday"]){
    const parsed=parseQuickAddDetailed(`Review ${phrase}`,{now});
    assert.equal(parsed.input.dueDate,"2026-08-26",phrase);
    assert.equal(parsed.input.title,"Review",phrase);
    assert.equal(parsed.tokens.find((token)=>token.type==="date")?.text,phrase,phrase);
  }
  assert.equal(parseQuickAdd("Review Thursday",{now}).dueDate,"2026-08-27");
  assert.equal(parseQuickAdd("Gym every Thursday",{now}).recurrenceRule,"FREQ=WEEKLY;BYDAY=TH");
  assert.equal(parseQuickAdd("Gym every Thursday",{now}).dueDate,"2026-08-27");
  assert.equal(parseQuickAdd("Gym every wed",{now}).recurrenceRule,"FREQ=WEEKLY;BYDAY=WE");
  assert.equal(parseQuickAdd("Gym every wed",{now}).dueDate,"2026-08-26");
});
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
test("every detected highlight is an exact, ordered source range",()=>{
  const source='A deliberately long prefix before #Personal Projects then @CS3219(TA) ^urgent *"Marina Bay" this wednesday at 3:30pm';
  const tokens=assertExactRanges(source);
  assert.deepEqual(tokens.map((token)=>token.text),["#Personal Projects","@CS3219(TA)","^urgent",'*"Marina Bay"',"this wednesday","at 3:30pm"]);
});
test("weekday detection cleanly replaces an abbreviation as typing continues",()=>{
  for(const source of ["Plan this wed","Plan this wedn","Plan this wedne","Plan this wednes","Plan this wednesday"]){
    const tokens=assertExactRanges(source);
    const date=tokens.find((token)=>token.type==="date");
    if(source.endsWith("wed"))assert.equal(date?.text,"this wed");
    else if(source.endsWith("wednesday"))assert.equal(date?.text,"this wednesday");
    else assert.equal(date,undefined);
  }
});
test("later parameters never shift or widen earlier highlight ranges",()=>{
  const stages=["Write report tomorrow","Write report tomorrow for the whole team ^high","Write report tomorrow for the whole team ^high @finance","Write report tomorrow for the whole team ^high @finance #Work"];
  for(const source of stages){
    const tokens=assertExactRanges(source);
    assert.equal(tokens.find((token)=>token.type==="date")?.text,"tomorrow");
    assert.equal(tokens.find((token)=>token.type==="date")?.start,"Write report ".length);
  }
});
