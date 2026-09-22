import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyEntry,validateEntry,sleepHours,sleepStartDay,compareGroups,upsertEntries,nextNightPairs,bedtimeGroup,napGroup,csvExport} from '../lib/diary.ts';
test('sleep spans are assigned to waking date, including midnight',()=>{
 const late={...emptyEntry('2026-09-09'),sleepTime:'03:00',wakeTime:'11:00'};
 assert.equal(sleepHours(late),8);assert.equal(sleepStartDay(late),'2026-09-09');
 const early={...late,sleepTime:'23:30',wakeTime:'08:00'};
 assert.equal(sleepHours(early),8.5);assert.equal(sleepStartDay(early),'2026-09-08');
 assert.equal(sleepHours({...early,nightAwakeMinutes:30}),8);
});
test('missing is excluded; an explicit zero belongs to the no exercise group',()=>{
 const entries=[null,0,20].map((n,i)=>({...emptyEntry(`2026-09-0${i+1}`),exerciseMinutes:n,clarity:i+1}));
 const groups=compareGroups(entries,e=>e.exerciseMinutes===null?null:e.exerciseMinutes===0?0:1);
 assert.deepEqual(groups.map(g=>g.count),[1,1]);assert.deepEqual(groups.map(g=>g.clarity),[2,3]);
});
test('editing one date replaces it without duplicating history',()=>{
 const saved={...emptyEntry('2026-09-09'),clarity:2,updatedAt:'first'};
 const next=upsertEntries([saved],{...saved,clarity:4,updatedAt:'second'});
 assert.equal(next.length,1);assert.equal(next[0].clarity,4);assert.equal(next[0].day,saved.day);
});
test('next night matching does not skip missing calendar dates',()=>{
 const entries=['2026-09-09','2026-09-10','2026-09-12'].map(day=>emptyEntry(day));
 assert.equal(nextNightPairs(entries).length,1);assert.equal(nextNightPairs(entries)[0].day,'2026-09-09');
});
test('bedtime grouping respects midnight and excludes daytime sleep',()=>{
 const entry=emptyEntry('2026-09-09');
 assert.equal(bedtimeGroup({...entry,sleepTime:'23:30'}),0);assert.equal(bedtimeGroup({...entry,sleepTime:'00:00'}),0);
 assert.equal(bedtimeGroup({...entry,sleepTime:'02:00'}),1);assert.equal(bedtimeGroup({...entry,sleepTime:'14:00'}),null);
});
test('invalid dates, equal times, empty entries and invalid scores are rejected',()=>{
 assert.throws(()=>validateEntry({...emptyEntry('2026-02-30'),clarity:3}));
 assert.throws(()=>validateEntry({...emptyEntry('2026-09-09'),clarity:6}));
 assert.throws(()=>validateEntry({...emptyEntry('2026-09-09'),sleepTime:'03:00',wakeTime:'03:00'}));
 assert.throws(()=>validateEntry(emptyEntry('2026-09-09')));
 assert.equal(validateEntry({...emptyEntry('2026-09-09'),exerciseMinutes:0}).exerciseMinutes,0);
});
test('CSV retains missing values and protects spreadsheet formula cells',()=>{
 const csv=csvExport([{...emptyEntry('2026-09-09'),notes:'=1+1',exerciseMinutes:0}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"0"'));
});
test('legacy missing naps remain unknown; explicit no nap and actual naps compare separately',()=>{
 const legacy=validateEntry({day:'2026-09-09',clarity:3});
 assert.equal(legacy.napMinutes,null);assert.equal(legacy.napStartTime,null);assert.equal(legacy.napFeeling,null);
 const noNap=validateEntry({...legacy,napMinutes:0,napStartTime:'14:00',napFeeling:3});
 assert.equal(noNap.napStartTime,null);assert.equal(noNap.napFeeling,null);
 const nap=validateEntry({...legacy,napMinutes:25,napStartTime:'14:10',napFeeling:3,sleepTime:'03:00',wakeTime:'11:00'});
 assert.equal(sleepHours(nap),8);assert.equal(nap.napMinutes,25);
 assert.deepEqual(compareGroups([legacy,noNap,nap],napGroup).map(g=>g.count),[1,1]);
 const csv=csvExport([nap]);assert.ok(csv.includes('午睡分钟'));assert.ok(csv.includes('"25","14:10","3"'));
});
test('invalid nap durations, times and feelings cannot be saved',()=>{
 const entry={...emptyEntry('2026-09-09'),clarity:3,napMinutes:20};
 for(const napMinutes of [-1,1.5,1441,'20'])assert.throws(()=>validateEntry({...entry,napMinutes}));
 assert.throws(()=>validateEntry({...entry,napStartTime:'25:00'}));
 assert.throws(()=>validateEntry({...entry,napFeeling:4}));
});

test('focus minutes are optional, bounded, and exported',()=>{
 const entry=validateEntry({...emptyEntry('2026-09-09'),focusMinutes:25});
 assert.equal(entry.focusMinutes,25);
 assert.throws(()=>validateEntry({...entry,focusMinutes:1441}));
 assert.ok(csvExport([entry]).includes('专注工作分钟'));
 assert.ok(csvExport([entry]).includes('"25"'));
});
