import type { CreateTaskInput, Project, Tag } from "@pulse/api-client";
import { generateRecurrenceRule, type Priority, type Weekday } from "@pulse/domain";

export type DetectionType="date"|"time"|"project"|"label"|"priority"|"recurrence";
export interface DetectedToken { id:string; type:DetectionType; start:number; end:number; text:string; label:string; }
export interface QuickAddContext { projects?:Project[]; tags?:Tag[]; defaultProjectId?:string|null; now?:Date; ignoredTokenIds?:Set<string>; }
export interface QuickAddDetailed { input:CreateTaskInput; tokens:DetectedToken[]; }

type Candidate=Omit<DetectedToken,"id"> & { value?:unknown };
const WEEKDAYS:Record<string,{day:number;rrule:Weekday}>={sun:{day:0,rrule:"SU"},sunday:{day:0,rrule:"SU"},mon:{day:1,rrule:"MO"},monday:{day:1,rrule:"MO"},tue:{day:2,rrule:"TU"},tues:{day:2,rrule:"TU"},tuesday:{day:2,rrule:"TU"},wed:{day:3,rrule:"WE"},wednesday:{day:3,rrule:"WE"},thu:{day:4,rrule:"TH"},thur:{day:4,rrule:"TH"},thurs:{day:4,rrule:"TH"},thursday:{day:4,rrule:"TH"},fri:{day:5,rrule:"FR"},friday:{day:5,rrule:"FR"},sat:{day:6,rrule:"SA"},saturday:{day:6,rrule:"SA"}};
const WEEKDAY_WORD="sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?";
const MONTHS:Record<string,number>={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
const MONTH_WORD=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).join("|");
const PRIORITIES:Record<string,Priority>={none:"none",low:"low",medium:"medium",med:"medium",high:"high",urgent:"urgent"};
const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function validLocalDate(y:number,m:number,d:number){const v=new Date(y,m,d);return v.getFullYear()===y&&v.getMonth()===m&&v.getDate()===d?v:null;}
function nextWeekday(now:Date,target:number,forceNext:boolean){const v=new Date(now);v.setHours(0,0,0,0);let add=(target-v.getDay()+7)%7;if(forceNext&&add===0)add=7;v.setDate(v.getDate()+add);return v;}
function byName<T extends {name:string}>(items:T[]|undefined,name:string){return items?.find((item)=>item.name.toLowerCase()===name.toLowerCase());}
function overlaps(a:Candidate,b:Candidate){return a.start<b.end&&b.start<a.end;}
function pushCandidate(list:Candidate[],candidate:Candidate){if(!list.some((x)=>overlaps(x,candidate)))list.push(candidate);}
function tokenise(candidates:Candidate[]):Array<Candidate&{id:string}>{const counts=new Map<string,number>();return [...candidates].sort((a,b)=>a.start-b.start||b.end-a.end).map((c)=>{const base=`${c.type}:${c.text.toLowerCase()}`;const n=counts.get(base)??0;counts.set(base,n+1);return{...c,id:`${base}:${n}`};});}
function parseTimeParts(hourRaw:string,minuteRaw:string|undefined,ampm:string|undefined){let hour=Number(hourRaw);if(ampm){hour%=12;if(ampm.toLowerCase()==="pm")hour+=12;}return{hour,minute:Number(minuteRaw??0)};}
function makeLocalInstant(dateKey:string,hour:number,minute:number){const [y,m,d]=dateKey.split("-").map(Number);return new Date(y,m-1,d,hour,minute,0,0).toISOString();}

function recurrenceCandidate(text:string):Candidate|undefined{
  const patterns:Array<[RegExp,(m:RegExpMatchArray)=>{rule:string;weekday?:number;label:string}]>=[
    [/\bevery\s+(\d+)\s+days?\b/i,(m)=>({rule:generateRecurrenceRule({frequency:"daily",interval:Number(m[1])}),label:`Every ${m[1]} days`})],
    [/\b(?:every\s+other\s+week|biweekly)\b/i,()=>({rule:generateRecurrenceRule({frequency:"weekly",interval:2}),label:"Every 2 weeks"})],
    [new RegExp(`\\bevery\\s+(${WEEKDAY_WORD})\\b`,"i"),(m)=>{const info=WEEKDAYS[m[1].toLowerCase()]!;return{rule:generateRecurrenceRule({frequency:"weekly",byWeekday:[info.rrule]}),weekday:info.day,label:`Every ${m[1]}`};}],
    [/\bevery\s+weekdays?\b/i,()=>({rule:generateRecurrenceRule({frequency:"weekly",byWeekday:["MO","TU","WE","TH","FR"]}),label:"Every weekday"})],
    [/\bevery\s+(day|daily|week|weekly|month|monthly|year|yearly)\b/i,(m)=>{const t=m[1].toLowerCase();const frequency=t.startsWith("day")?"daily":t.startsWith("week")?"weekly":t.startsWith("month")?"monthly":"yearly";return{rule:generateRecurrenceRule({frequency}),label:`Every ${frequency.replace("ly","")}`};}],
  ];
  for(const [regex,build] of patterns){const m=text.match(regex);if(m&&m.index!==undefined){const value=build(m);return{type:"recurrence",start:m.index,end:m.index+m[0].length,text:m[0],label:value.label,value};}}
}
function dateCandidate(text:string,now:Date,blocked:Candidate[]):Candidate|undefined{
  const tries:Array<()=>Candidate|undefined>=[
    ()=>{const m=text.match(/\b(\d{4}-\d{2}-\d{2})\b/);return m&&m.index!==undefined?{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[1],value:m[1]}:undefined;},
    ()=>{const m=text.match(/\b(today|tomorrow)\b/i);if(!m||m.index===undefined)return;const d=new Date(now);d.setHours(0,0,0,0);if(m[1].toLowerCase()==="tomorrow")d.setDate(d.getDate()+1);return{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[1],value:localDate(d)};},
    ()=>{const m=text.match(new RegExp(`\\bnext\\s+(${WEEKDAY_WORD})\\b`,"i"));if(!m||m.index===undefined)return;const info=WEEKDAYS[m[1].toLowerCase()];return info?{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[0],value:localDate(nextWeekday(now,info.day,true))}:undefined;},
    ()=>{const m=text.match(new RegExp(`\\b(${WEEKDAY_WORD})\\b`,"i"));if(!m||m.index===undefined)return;const info=WEEKDAYS[m[1].toLowerCase()];return info?{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[0],value:localDate(nextWeekday(now,info.day,false))}:undefined;},
    ()=>{const a=text.match(new RegExp(`\\b(${MONTH_WORD})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,"i"));const b=a?null:text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})(?:\\s+(\\d{4}))?\\b`,"i"));const m=a??b;if(!m||m.index===undefined)return;const monthName=(a?m[1]:m[2]).toLowerCase(),day=Number(a?m[2]:m[1]);let year=Number(m[3]||now.getFullYear());const month=MONTHS[monthName];let d=validLocalDate(year,month,day);if(d&&!m[3]&&d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d=validLocalDate(++year,month,day);return d?{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[0],value:localDate(d)}:undefined;},
    ()=>{const m=text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?\b/);if(!m||m.index===undefined)return;const day=Number(m[1]),month=Number(m[2])-1;let year=m[3]?Number(m[3]):now.getFullYear();if(year<100)year+=2000;let d=validLocalDate(year,month,day);if(d&&!m[3]&&d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d=validLocalDate(year+1,month,day);return d?{type:"date",start:m.index,end:m.index+m[0].length,text:m[0],label:m[0],value:localDate(d)}:undefined;},
  ];
  for(const fn of tries){const c=fn();if(c&&!blocked.some((b)=>overlaps(b,c)))return c;}
}
function timeCandidate(text:string,blocked:Candidate[]):Candidate|undefined{
  const range12=text.match(/\b(?:from\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)?\s*(?:-|–|to)\s*(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if(range12&&range12.index!==undefined){const c:Candidate={type:"time",start:range12.index,end:range12.index+range12[0].length,text:range12[0],label:range12[0],value:{start:parseTimeParts(range12[1],range12[2],range12[3]??range12[6]),end:parseTimeParts(range12[4],range12[5],range12[6])}};if(!blocked.some((b)=>overlaps(b,c)))return c;}
  const range24=text.match(/\b(?:from\s+)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|–|to)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if(range24&&range24.index!==undefined){const c:Candidate={type:"time",start:range24.index,end:range24.index+range24[0].length,text:range24[0],label:range24[0],value:{start:parseTimeParts(range24[1],range24[2],undefined),end:parseTimeParts(range24[3],range24[4],undefined)}};if(!blocked.some((b)=>overlaps(b,c)))return c;}
  const twelve=text.match(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if(twelve&&twelve.index!==undefined){const c:Candidate={type:"time",start:twelve.index,end:twelve.index+twelve[0].length,text:twelve[0],label:twelve[0],value:{start:parseTimeParts(twelve[1],twelve[2],twelve[3])}};if(!blocked.some((b)=>overlaps(b,c)))return c;}
  const twentyFour=text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if(twentyFour&&twentyFour.index!==undefined){const c:Candidate={type:"time",start:twentyFour.index,end:twentyFour.index+twentyFour[0].length,text:twentyFour[0],label:twentyFour[0],value:{start:parseTimeParts(twentyFour[1],twentyFour[2],undefined)}};if(!blocked.some((b)=>overlaps(b,c)))return c;}
}

export function parseQuickAddDetailed(text:string,context:QuickAddContext={}):QuickAddDetailed{
  const now=context.now??new Date();const candidates:Candidate[]=[];
  const recurrence=recurrenceCandidate(text);if(recurrence)pushCandidate(candidates,recurrence);
  const projectRegex=/(?:^|\s)#([\p{L}\p{N}_-]+)/gu;for(const m of text.matchAll(projectRegex)){const project=byName(context.projects,m[1]);if(project&&m.index!==undefined){const prefix=m[0].length-m[0].trimStart().length;pushCandidate(candidates,{type:"project",start:m.index+prefix,end:m.index+m[0].length,text:m[0].trim(),label:project.name,value:project.id});}}
  const labelRegex=/(?:^|\s)@([\p{L}\p{N}_-]+)/gu;for(const m of text.matchAll(labelRegex)){const tag=byName(context.tags,m[1]);if(tag&&m.index!==undefined){const prefix=m[0].length-m[0].trimStart().length;pushCandidate(candidates,{type:"label",start:m.index+prefix,end:m.index+m[0].length,text:m[0].trim(),label:tag.name,value:tag.id});}}
  const priorityRegex=/(?:^|\s)\^(none|low|medium|med|high|urgent)\b/giu;for(const m of text.matchAll(priorityRegex)){if(m.index!==undefined){const prefix=m[0].length-m[0].trimStart().length;const p=PRIORITIES[m[1].toLowerCase()];pushCandidate(candidates,{type:"priority",start:m.index+prefix,end:m.index+m[0].length,text:m[0].trim(),label:p[0].toUpperCase()+p.slice(1),value:p});}}
  const date=dateCandidate(text,now,candidates);if(date)pushCandidate(candidates,date);
  const time=timeCandidate(text,candidates);if(time)pushCandidate(candidates,time);
  const all=tokenise(candidates);const ignored=context.ignoredTokenIds??new Set<string>();const active=all.filter((t)=>!ignored.has(t.id));
  const input:CreateTaskInput={title:"",projectId:context.defaultProjectId??null,priority:"none"};let recurrenceWeekday:number|undefined;
  for(const token of active){if(token.type==="project")input.projectId=token.value as string;if(token.type==="label")input.tagIds=[...(input.tagIds??[]),token.value as string];if(token.type==="priority")input.priority=token.value as Priority;if(token.type==="recurrence"){const v=token.value as {rule:string;weekday?:number};input.recurrenceRule=v.rule;recurrenceWeekday=v.weekday;}}
  const dateToken=active.find((t)=>t.type==="date");let dateKey=dateToken?.value as string|undefined;
  if(!dateKey&&recurrenceWeekday!==undefined)dateKey=localDate(nextWeekday(now,recurrenceWeekday,false));
  if(!dateKey&&input.recurrenceRule)dateKey=localDate(now);
  const timeToken=active.find((t)=>t.type==="time");
  if(timeToken){const v=timeToken.value as {start:{hour:number;minute:number};end?:{hour:number;minute:number}};const day=dateKey??localDate(now);input.startAt=makeLocalInstant(day,v.start.hour,v.start.minute);if(v.end){let end=makeLocalInstant(day,v.end.hour,v.end.minute);if(new Date(end)<new Date(input.startAt)) {const d=new Date(end);d.setDate(d.getDate()+1);end=d.toISOString();}input.endAt=end;}}
  else if(dateKey)input.dueDate=dateKey;
  if(input.tagIds)input.tagIds=[...new Set(input.tagIds)];
  let title=text;for(const token of [...active].sort((a,b)=>b.start-a.start))title=title.slice(0,token.start)+" "+title.slice(token.end);input.title=title.replace(/\s+/g," ").trim();
  return{input,tokens:all};
}
export function parseQuickAdd(text:string,context:QuickAddContext={}):CreateTaskInput{return parseQuickAddDetailed(text,context).input;}
export function resolveQuickAddProjectId(text:string,projects:Project[]|undefined,defaultProjectId?:string|null):string|null|undefined{return parseQuickAddDetailed(text,{projects,defaultProjectId}).input.projectId;}
