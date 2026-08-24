import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTasksByPriority, generateRecurrenceRule, isTaskCompleted, isTaskDueToday,
  isTaskFocus, isTaskInInbox, isTaskOverdue, isTaskUpcoming, nextRecurrenceDate,
  nextRecurrenceInstant, normalizeTaskSchedule, parseRecurrenceRule, sortTasksForView,
  type Task,
} from "./index.ts";

const baseTask: Task = {
  id:"t1",userId:"u1",title:"Task",description:null,location:null,status:"open",priority:"none",
  startAt:null,endAt:null,due:{date:null,at:null},recurrenceRule:null,completedAt:null,
  deletedAt:null,projectId:null,parentTaskId:null,sortOrder:0,revision:0,tags:[],reminders:[],
  createdAt:"2026-08-20T00:00:00Z",updatedAt:"2026-08-20T00:00:00Z",
};

test("keeps scheduled windows separate from deadlines",()=>{
  assert.deepEqual(normalizeTaskSchedule({startAt:"2026-08-20T09:00:00Z",endAt:"2026-08-20T10:00:00Z",dueDate:"2026-08-21"}),{
    startAt:"2026-08-20T09:00:00Z",endAt:"2026-08-20T10:00:00Z",due:{date:"2026-08-21",at:null},
  });
});
test("keeps date-only due dates separate from timed deadlines",()=>{
  assert.deepEqual(normalizeTaskSchedule({dueDate:"2026-08-20"}),{startAt:null,endAt:null,due:{date:"2026-08-20",at:null}});
  assert.deepEqual(normalizeTaskSchedule({dueAt:"2026-08-20T09:00:00Z"}),{startAt:null,endAt:null,due:{date:null,at:"2026-08-20T09:00:00Z"}});
});
test("validates task schedule invariants",()=>{
  assert.throws(()=>normalizeTaskSchedule({dueDate:"2026-08-20T09:00:00Z"}),/dueDate must use YYYY-MM-DD/);
  assert.throws(()=>normalizeTaskSchedule({dueDate:"2026-99-99"}),/real calendar date/);
  assert.throws(()=>normalizeTaskSchedule({dueDate:"2026-08-20",dueAt:"2026-08-20T09:00:00Z"}),/either dueDate or dueAt/);
  assert.throws(()=>normalizeTaskSchedule({endAt:"2026-08-20T10:00:00Z"}),/endAt requires startAt/);
  assert.throws(()=>normalizeTaskSchedule({startAt:"2026-08-20T10:00:00Z",endAt:"2026-08-20T09:00:00Z"}),/endAt must not be before startAt/);
  for(const field of ["startAt","endAt","dueAt"] as const) assert.throws(()=>normalizeTaskSchedule({startAt:field==="endAt"?"2026-08-20T08:00:00Z":undefined,[field]:"bad"}),new RegExp(`${field} must be a valid ISO instant`));
});

test("sorts tasks by priority descending",()=>{
  const tasks:Task[]=[{...baseTask,id:"low",priority:"low"},{...baseTask,id:"urgent",priority:"urgent"},{...baseTask,id:"none",priority:"none"}];
  tasks.sort(compareTasksByPriority); assert.deepEqual(tasks.map(t=>t.id),["urgent","low","none"]);
});
test("inbox contains open tasks without a project",()=>{
  assert.equal(isTaskInInbox(baseTask),true);assert.equal(isTaskInInbox({...baseTask,projectId:"p1"}),false);assert.equal(isTaskInInbox({...baseTask,status:"completed"}),false);
});
test("today prefers scheduled start, then timed/date-only deadline, and ignores reminders",()=>{
  const now=new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskDueToday({...baseTask,startAt:"2026-08-20T15:00:00Z",due:{date:"2026-08-21",at:null}},now),true);
  assert.equal(isTaskDueToday({...baseTask,due:{date:"2026-08-20",at:null}},now),true);
  assert.equal(isTaskDueToday({...baseTask,due:{date:null,at:"2026-08-20T15:00:00Z"}},now),true);
  assert.equal(isTaskDueToday({...baseTask,reminders:[{id:"r",taskId:"t1",userId:"u1",remindAt:"2026-08-20T08:00:00Z",channel:"hermes_telegram",status:"pending",createdAt:"2026-08-19T00:00:00Z",updatedAt:"2026-08-19T00:00:00Z",deletedAt:null}]},now),false);
});
test("today respects user timezone",()=>{
  const now=new Date("2026-08-21T03:00:00Z");
  assert.equal(isTaskDueToday({...baseTask,due:{date:"2026-08-20",at:null}},now,"UTC"),false);
  assert.equal(isTaskDueToday({...baseTask,due:{date:"2026-08-20",at:null}},now,"America/New_York"),true);
});
test("upcoming and overdue semantics",()=>{
  const now=new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskUpcoming({...baseTask,startAt:"2026-08-21T09:00:00Z"},now),true);
  assert.equal(isTaskUpcoming({...baseTask,due:{date:"2026-08-20",at:null}},now),false);
  assert.equal(isTaskOverdue({...baseTask,due:{date:"2026-08-19",at:null}},now),true);
  assert.equal(isTaskOverdue({...baseTask,startAt:"2026-08-19T09:00:00Z",due:{date:null,at:null}},now),false);
});
test("completed and focus semantics",()=>{
  const now=new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskCompleted({...baseTask,status:"completed"}),true);
  assert.equal(isTaskCompleted({...baseTask,status:"completed",deletedAt:"2026-08-20T00:00:00Z"}),false);
  assert.equal(isTaskFocus({...baseTask,priority:"high"},now),true);
  assert.equal(isTaskFocus({...baseTask,priority:"low",due:{date:"2026-08-22",at:null}},now),false);
});
test("sortTasksForView orders scheduled work first and deterministically",()=>{
  const tasks:Task[]=[{...baseTask,id:"b",due:{date:"2026-08-22",at:null},priority:"low"},{...baseTask,id:"a",startAt:"2026-08-21T09:00:00Z",priority:"high"},{...baseTask,id:"c",priority:"urgent"}];
  assert.deepEqual(sortTasksForView(tasks,"upcoming").map(t=>t.id),["a","b","c"]);
});

test("recurrence RRULE generation and parsing are deterministic",()=>{
  const rule=generateRecurrenceRule({frequency:"weekly",interval:2,byWeekday:["MO","FR"],count:5});
  assert.equal(rule,"FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=5");assert.deepEqual(parseRecurrenceRule(rule),{frequency:"weekly",interval:2,byWeekday:["MO","FR"],count:5});
});
test("late weekly completion skips missed occurrence without cadence drift",()=>{
  assert.equal(nextRecurrenceDate("2026-08-19","FREQ=WEEKLY","2026-08-20"),"2026-08-26");
});
test("specific day intervals remain anchored to original occurrence",()=>{
  assert.equal(nextRecurrenceDate("2026-08-01","FREQ=DAILY;INTERVAL=10","2026-08-12"),"2026-08-21");
});
test("biweekly and monthly recurrences skip late occurrences",()=>{
  assert.equal(nextRecurrenceDate("2026-08-05","FREQ=WEEKLY;INTERVAL=2","2026-08-20"),"2026-09-02");
  assert.equal(nextRecurrenceDate("2026-01-31","FREQ=MONTHLY","2026-03-02"),"2026-03-31");
});
test("timed recurrence preserves anchored time of day",()=>{
  assert.equal(nextRecurrenceInstant("2026-08-19T11:30:00.000Z","FREQ=WEEKLY",new Date("2026-08-20T12:00:00Z")),"2026-08-26T11:30:00.000Z");
});
