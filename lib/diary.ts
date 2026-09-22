export type DiaryEntry = {
  day: string;
  sleepTime: string | null;
  wakeTime: string | null;
  nightAwakeMinutes: number | null;
  napMinutes: number | null;
  napStartTime: string | null;
  napFeeling: number | null;
  clarity: number | null;
  exerciseMinutes: number | null;
  coffeeCups: number | null;
  lastCoffeeTime: string | null;
  mood: number | null;
  focus: number | null;
  focusMinutes: number | null;
  brainFog: number | null;
  morningClarity: number | null;
  afternoonClarity: number | null;
  eveningClarity: number | null;
  sleepyTime: string | null;
  notes: string;
};
export type SavedEntry = DiaryEntry & { updatedAt: string };
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDay(value: unknown): value is string {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function shiftDay(day:string, amount:number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+amount);
  return date.toISOString().slice(0,10);
}
export function minutes(time:string) { const [h,m]=time.split(':').map(Number); return h*60+m; }
export function sleepHours(entry: Pick<DiaryEntry,'sleepTime'|'wakeTime'|'nightAwakeMinutes'>): number | null {
  if(!entry.sleepTime || !entry.wakeTime) return null;
  const span=(minutes(entry.wakeTime)-minutes(entry.sleepTime)+1440)%1440;
  if(span===0) return null;
  return (span-(entry.nightAwakeMinutes??0))/60;
}
export function sleepStartDay(entry: Pick<DiaryEntry,'day'|'sleepTime'|'wakeTime'>) {
  if(!entry.sleepTime || !entry.wakeTime) return null;
  return minutes(entry.sleepTime)>=minutes(entry.wakeTime)?shiftDay(entry.day,-1):entry.day;
}
export function emptyEntry(day: string): DiaryEntry {
  return {day,sleepTime:null,wakeTime:null,nightAwakeMinutes:null,napMinutes:null,napStartTime:null,napFeeling:null,clarity:null,exerciseMinutes:null,coffeeCups:null,lastCoffeeTime:null,mood:null,focus:null,focusMinutes:null,brainFog:null,morningClarity:null,afternoonClarity:null,eveningClarity:null,sleepyTime:null,notes:''};
}
const timeFields=['sleepTime','wakeTime','lastCoffeeTime','sleepyTime','napStartTime'] as const;
const ratingFields=['clarity','mood','focus','brainFog','morningClarity','afternoonClarity','eveningClarity'] as const;
export function validateEntry(input:unknown):DiaryEntry {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('记录格式不正确。');
  const obj=input as Record<string,unknown>;
  if(!validDay(obj.day)) throw new Error('请选择有效的记录日期。');
  const result=emptyEntry(obj.day);
  for(const key of timeFields){
    const value=obj[key];
    if(value===undefined||value===null||value==='')continue;
    if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('请填写有效的时间。');
    result[key]=value;
  }
  for(const key of ratingFields){
    const value=obj[key];
    if(value===undefined||value===null)continue;
    if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>5)throw new Error('状态评分应在 1–5 之间。');
    result[key]=value;
  }
  for(const [key,max] of [['exerciseMinutes',1440],['coffeeCups',30],['nightAwakeMinutes',1440],['napMinutes',1440],['focusMinutes',1440]] as const){
    const value=obj[key];
    if(value===undefined||value===null)continue;
    if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>max)throw new Error('分钟数或杯数超出有效范围。');
    result[key]=value;
  }
  if(obj.notes!==undefined&&typeof obj.notes!=='string')throw new Error('备注格式不正确。');
  result.notes=((obj.notes??'') as string).trim();
  if(result.notes.length>1000)throw new Error('备注请控制在 1000 字以内。');
  if(result.coffeeCups===0)result.lastCoffeeTime=null;
  if(obj.napFeeling!==undefined&&obj.napFeeling!==null){
    if(typeof obj.napFeeling!=='number'||!Number.isInteger(obj.napFeeling)||obj.napFeeling<1||obj.napFeeling>3)throw new Error('请选择有效的午睡后感受。');
    result.napFeeling=obj.napFeeling;
  }
  if(result.napMinutes===0||result.napMinutes===null){result.napStartTime=null;result.napFeeling=null;}
  if(result.sleepTime&&result.wakeTime){
    if(result.sleepTime===result.wakeTime)throw new Error('入睡与起床时间相同，请核对。');
    const hours=sleepHours(result)!;
    if(hours<=0)throw new Error('夜间清醒时间不能超过整段睡眠时段。');
    if(hours>20)throw new Error('睡眠时段超过 20 小时，请核对入睡和起床时间。');
  }
  if(Object.entries(result).every(([key,value])=>key==='day'||value===null||value===''))throw new Error('先记录一项，再保存。');
  return result;
}
export function upsertEntries(entries:SavedEntry[], saved:SavedEntry) {
  return [...entries.filter(e=>e.day!==saved.day),saved].sort((a,b)=>b.day.localeCompare(a.day));
}
export function mean(values:(number|null)[]) {
  const clean=values.filter((v):v is number=>v!==null&&Number.isFinite(v));
  return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:null;
}
export function compareGroups(entries:DiaryEntry[], classify:(entry:DiaryEntry)=>0|1|null) {
  const groups:[DiaryEntry[],DiaryEntry[]]=[[],[]];
  for(const entry of entries){const group=classify(entry);if(group!==null&&entry.clarity!==null)groups[group].push(entry);}
  return groups.map(group=>({count:group.length,clarity:mean(group.map(e=>e.clarity)),sleep:mean(group.map(sleepHours))}));
}
export function bedtimeGroup(entry:DiaryEntry):0|1|null {
  if(!entry.sleepTime)return null;
  const minute=minutes(entry.sleepTime);
  // Only compare overnight sleeping schedules; daylight sleep remains outside both groups.
  if(minute>=360&&minute<1080)return null;
  return minute>=1080||minute<120?0:1;
}
export function napGroup(entry:Pick<DiaryEntry,'napMinutes'>):0|1|null {
  return entry.napMinutes==null?null:entry.napMinutes===0?0:1;
}
export function nextNightPairs(entries:DiaryEntry[]) {
  const byDay=new Map(entries.map(e=>[e.day,e]));
  return entries.flatMap(e=>{const next=byDay.get(shiftDay(e.day,1));return next?[{day:e.day,exerciseMinutes:e.exerciseMinutes,coffeeCups:e.coffeeCups,nextSleepHours:sleepHours(next)}]:[];});
}
export function csvExport(entries:DiaryEntry[]):string {
  const columns:(keyof DiaryEntry)[]=['day','sleepTime','wakeTime','nightAwakeMinutes','clarity','exerciseMinutes','coffeeCups','lastCoffeeTime','mood','focus','focusMinutes','brainFog','morningClarity','afternoonClarity','eveningClarity','sleepyTime','notes','napMinutes','napStartTime','napFeeling'];
  const names=['记录日期（起床日）','估计入睡','起床','夜间清醒分钟','整体清醒1-5','运动分钟','咖啡杯数','最后咖啡时间','情绪1-5','学习专注1-5','专注工作分钟','脑雾1轻5重','起床后清醒','起床4-6小时清醒','晚间清醒','首次明显困意','备注','午睡分钟（0为没午睡）','午睡开始时间','午睡后感受（1更困2差不多3更清醒）'];
  const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[names.map(cell).join(','),...entries.map(e=>columns.map(key=>cell(e[key])).join(','))].join('\r\n');
}
