'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Sunrise, Moon, Sun, Activity, Coffee, LockKeyhole, ChevronLeft, ChevronRight, Check, Download, Pencil, Trash2, BookOpen, ArrowUpRight, LoaderCircle, CircleHelp, Save, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Empty as EmptyPrimitive } from '@/components/ui/empty';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { emptyEntry, localDay, shiftDay, sleepHours, sleepStartDay, validDay, validateEntry, upsertEntries, mean, compareGroups, bedtimeGroup, napGroup, csvExport, minutes, type DiaryEntry, type SavedEntry } from '@/lib/diary';

const clearLabels=['很慢','偏慢','一般','清晰','很好'];
const napFeelingLabels=['更困','差不多','更清醒'];
const fmt=(value:number|null,digits=1)=>value===null?'—':value.toFixed(digits).replace(/\.0$/,'');
const dateLabel=(day:string)=>day?`${Number(day.slice(5,7))} 月 ${Number(day.slice(8,10))} 日`:'';
type Status={kind:'error'|'ok'|'info';text:string}|null;

function Choices({id,label,value,options,onChange}:{id:string;label:string;value:number|null;options:{value:number;label:string}[];onChange:(value:number|null)=>void}) {
  return <div className="choices-wrap"><RadioGroup aria-label={label} value={value===null?'':String(value)} onValueChange={v=>onChange(v===''?null:Number(v))} className="choices">
    {options.map(option=><label key={option.value} className={`choice ${value===option.value?'selected':''}`} htmlFor={`${id}-${option.value}`}><RadioGroupItem id={`${id}-${option.value}`} value={String(option.value)} className="choice-radio"/><span>{option.label}</span></label>)}
  </RadioGroup>{value!==null&&<Button type="button" variant="ghost" className="clear-choice" onClick={()=>onChange(null)} aria-label={`清除${label}`}>清除</Button>}</div>;
}
function Score({id,label,value,onChange,labels=clearLabels}:{id:string;label:string;value:number|null;onChange:(value:number|null)=>void;labels?:string[]}){
  return <div className="score-field"><div className="field-label">{label}<span>{value===null?'未记录':`${value} / 5`}</span></div><Choices id={id} label={label} value={value} options={labels.map((text,i)=>({value:i+1,label:`${i+1} ${text}`}))} onChange={onChange}/></div>;
}
const LOCAL_ENTRIES_KEY='clear-day-entries-v1';
function localEntries():SavedEntry[]{
  try{
    const raw=localStorage.getItem(LOCAL_ENTRIES_KEY);if(!raw)return [];
    const value=JSON.parse(raw);return Array.isArray(value)?value:[];
  }catch{return []}
}
function saveLocalEntries(entries:SavedEntry[]){localStorage.setItem(LOCAL_ENTRIES_KEY,JSON.stringify(entries));}
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  if(typeof window!=='undefined'&&path.startsWith('/api/')){
    const method=(init?.method??'GET').toUpperCase();
    if(path.startsWith('/api/session')){
      if(method==='DELETE')localStorage.removeItem('clear-day-access-v1');
      return {} as T;
    }
    const entries=localEntries();
    if(method==='GET')return {entries} as T;
    if(method==='PUT'){
      const value=validateEntry(JSON.parse(String(init?.body??'{}')));
      const saved={...value,updatedAt:new Date().toISOString()};
      saveLocalEntries(upsertEntries(entries,saved));return {entry:saved} as T;
    }
    if(method==='DELETE'){
      const day=new URLSearchParams(path.split('?')[1]??'').get('day');
      saveLocalEntries(entries.filter(entry=>entry.day!==day));return {deleted:day} as T;
    }
  }
  const response=await fetch(path,{...init,headers:{'Content-Type':'application/json',...init?.headers},cache:'no-store',signal:AbortSignal.timeout(20000)});
  let data:Record<string,unknown>;try{data=await response.json() as Record<string,unknown>;}catch{throw new Error('暂时无法连接，请稍后重试。');}
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'操作没有完成，请重试。');
  return data as T;
}
function draftKey(account:string,day:string){return `clear-day-draft:${account}:${day}`;}
function readDraft(account:string,day:string):DiaryEntry|null{
  try{const text=sessionStorage.getItem(draftKey(account,day));if(!text)return null;const value=validateEntry(JSON.parse(text));return value.day===day?value:null;}catch{return null;}
}

export default function DiaryApp({signedIn,accountKey}:{signedIn:boolean;accountKey:string}) {
  const [today,setToday]=useState('');
  const [entries,setEntries]=useState<SavedEntry[]>([]);
  const [form,setForm]=useState<DiaryEntry>(emptyEntry(''));
  const [tab,setTab]=useState('record');
  const [period,setPeriod]=useState(14);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState<Status>(null);
  const [deleting,setDeleting]=useState<string|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const stateRef=useRef({entries,form,dirty});
  stateRef.current={entries,form,dirty};

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const data=await request<{entries:SavedEntry[]}>('/api/entries');
      setEntries(data.entries);setReady(true);setStatus(null);
      const day=stateRef.current.form.day||localDay();
      if(!stateRef.current.dirty){const draft=readDraft(accountKey,day);setForm(draft??data.entries.find(e=>e.day===day)??emptyEntry(day));setDirty(!!draft);if(draft)setStatus({kind:'info',text:'已恢复未保存的草稿。'});}
    }catch(error){setStatus({kind:'error',text:error instanceof Error?error.message:'读取失败，请重试。'});}finally{setLoading(false);}
  },[accountKey]);

  useEffect(()=>{const day=localDay();setToday(day);setForm(emptyEntry(day));if(signedIn)void load();else setLoading(false);},[signedIn,load]);
  useEffect(()=>{
    if(!signedIn||!ready||dirty)return;
    const params=new URLSearchParams(window.location.search);
    const rawMean=Number(params.get('reaction_mean'));
    const hasReaction=Number.isFinite(rawMean)&&rawMean>=50&&rawMean<=5000;
    const rawFocus=Number(params.get('focus_minutes'));
    const hasFocus=Number.isFinite(rawFocus)&&rawFocus>=0&&rawFocus<=1440;
    if(!hasReaction&&!hasFocus)return;
    const importedDay=params.get('reaction_day')||params.get('focus_day');
    const day=validDay(importedDay)?importedDay:localDay();
    const integerParam=(name:string)=>{const value=Number(params.get(name));return Number.isFinite(value)&&value>=0&&value<=5000?Math.round(value):null;};
    const median=integerParam('reaction_median');
    const fastest=integerParam('reaction_fastest');
    const slowest=integerParam('reaction_slowest');
    const falseStarts=integerParam('reaction_false_starts');
    const stamped=params.get('reaction_date');
    const stamp=stamped&&Number.isFinite(new Date(stamped).getTime())?new Date(stamped).toLocaleString() : new Date().toLocaleString();
    const detail=hasReaction?[`平均 ${Math.round(rawMean)} ms`,median===null?null:`中位数 ${median} ms`,fastest===null?null:`最快 ${fastest} ms`,slowest===null?null:`最慢 ${slowest} ms`,falseStarts===null?null:`抢点 ${falseStarts} 次`].filter(Boolean).join(' · '):'';
    const marker=hasReaction?`反应时测试（${stamp}）：${detail}`:'';
    const existing=entries.find(entry=>entry.day===day);
    setForm(previous=>{
      const base=previous.day===day?previous:(existing??emptyEntry(day));
      const next={...base,...(hasFocus?{focusMinutes:Math.round(rawFocus)}:{})};
      if(!hasReaction||base.notes.includes(marker))return next;
      return {...next,notes:base.notes?[base.notes,marker].join('\n'):marker};
    });
    setDirty(true);setStatus({kind:'info',text:hasReaction&&hasFocus?'已把专注分钟和反应时结果带入，请检查后保存。':hasFocus?'已把今日专注分钟带入，请检查后保存。':'已把反应时结果放入这一天的备注，请检查后保存。'});
    window.history.replaceState({},'',`${window.location.pathname}${window.location.hash}`);
  },[signedIn,ready,dirty,entries]);
  useEffect(()=>{
    if(!dirty||!form.day)return;
    try{sessionStorage.setItem(draftKey(accountKey,form.day),JSON.stringify(form));}catch{/* The visible draft remains usable when browser storage is blocked. */}
    const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
  },[form,dirty,accountKey]);

  const update=<K extends keyof DiaryEntry>(key:K,value:DiaryEntry[K])=>{
    setForm(prev=>({...prev,[key]:value,...(key==='coffeeCups'&&value===0?{lastCoffeeTime:null}:{}),...(key==='napMinutes'&&(value===0||value===null)?{napStartTime:null,napFeeling:null}:{})}));setDirty(true);setStatus(null);
  };
  const pickDay=useCallback((day:string)=>{
    if(saving)return;
    const draft=readDraft(accountKey,day);setForm(draft??stateRef.current.entries.find(e=>e.day===day)??emptyEntry(day));setDirty(!!draft);setStatus(draft?{kind:'info',text:'已恢复这一天未保存的草稿。'}:null);
  },[accountKey,saving]);
  const persist=useCallback(async(input:unknown)=>{
    const validated=validateEntry(input);setSaving(true);
    try{
      const data=await request<{entry:SavedEntry}>('/api/entries',{method:'PUT',body:JSON.stringify(validated)});
      const next=upsertEntries(stateRef.current.entries,data.entry);setEntries(next);setForm(data.entry);setDirty(false);setStatus({kind:'ok',text:`${dateLabel(validated.day)}的记录已保存`});
      stateRef.current={entries:next,form:data.entry,dirty:false};
      try{sessionStorage.removeItem(draftKey(accountKey,validated.day));}catch{}
      return data.entry;
    }finally{setSaving(false);}
  },[accountKey]);
  const save=async()=>{try{await persist(form);}catch(error){setStatus({kind:'error',text:error instanceof Error?error.message:'保存失败，内容仍保留，请重试。'});}};

  useEffect(()=>{
    type Context={registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>unknown};
    const context=(document as Document&{modelContext?:Context}).modelContext;
    if(!context?.registerTool||!signedIn||!ready)return;
    const lifecycle=new AbortController();
    const tools=[
      {name:'read_sleep_diary',title:'查看睡眠日记',description:'读取已保存的睡眠、午睡、运动、咖啡和每日状态。记录归属起床日期；不包含未保存草稿。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({entries:stateRef.current.entries})},
      {name:'save_sleep_diary_day',title:'保存一天的记录',description:'按起床日期新增或更新日记。更新时保留未提供的字段；传 null 清除可选项。与页面保存使用同一接口。',inputSchema:{type:'object',properties:{day:{type:'string',description:'起床日期 YYYY-MM-DD'},sleepTime:{type:['string','null']},wakeTime:{type:['string','null']},napMinutes:{type:['integer','null'],minimum:0,maximum:1440,description:'午睡总分钟，0 没午睡，null 未记录'},napStartTime:{type:['string','null'],description:'第一次午睡开始时间 HH:mm，选填'},napFeeling:{type:['integer','null'],minimum:1,maximum:3,description:'1 更困、2 差不多、3 更清醒，选填'},clarity:{type:['integer','null'],minimum:1,maximum:5},exerciseMinutes:{type:['integer','null'],minimum:0,maximum:1440},coffeeCups:{type:['integer','null'],minimum:0,maximum:30},lastCoffeeTime:{type:['string','null']},mood:{type:['integer','null'],minimum:1,maximum:5},focus:{type:['integer','null'],minimum:1,maximum:5},focusMinutes:{type:['integer','null'],minimum:0,maximum:1440,description:'当天实际专注工作分钟，插件可自动带入'},notes:{type:'string',maxLength:1000}},required:['day'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{
        if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('记录格式不正确。');
        if(stateRef.current.dirty)throw new Error('页面有未保存的修改，请先保存或清除草稿。');
        const value=input as Partial<DiaryEntry>;const base=stateRef.current.entries.find(e=>e.day===value.day)??emptyEntry(value.day??'');
        const saved=await persist({...base,...value});setTab('record');return{day:saved.day,saved:true};
      }}
    ];
    for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return()=>lifecycle.abort();
  },[signedIn,ready,persist]);

  const recent=useMemo(()=>today?entries.filter(e=>e.day>=shiftDay(today,-6)&&e.day<=today):[],[entries,today]);
  const selected=entries.find(e=>e.day===form.day);
  const hours=sleepHours(form);
  const startDay=sleepStartDay(form);
  const previous=entries.find(e=>e.day<form.day&&e.sleepTime&&e.wakeTime);
  const remove=async()=>{
    if(!deleting)return;setDeleteBusy(true);
    try{await request(`/api/entries?day=${deleting}`,{method:'DELETE'});setEntries(prev=>prev.filter(e=>e.day!==deleting));if(form.day===deleting){setForm(emptyEntry(deleting));setDirty(false);}try{sessionStorage.removeItem(draftKey(accountKey,deleting));}catch{}setStatus({kind:'ok',text:'这一天的记录已删除。'});setDeleting(null);}catch(error){setStatus({kind:'error',text:error instanceof Error?error.message:'删除失败，请重试。'});setDeleting(null);}finally{setDeleteBusy(false);}
  };
  const exportData=()=>{const blob=new Blob([csvExport([...entries].reverse())],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`清醒日记-${today}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

  return <div className="diary-shell">
    <header className="app-header"><a className="brand" href="/"><span className="brand-icon"><Sunrise size={25}/></span><span>清醒日记<small>把每天的感觉，慢慢看清</small></span></a><span className="private-label"><LockKeyhole size={14}/> 私人记录<Button variant="ghost" className="lock-button" onClick={async()=>{if(dirty){setStatus({kind:'info',text:'请先保存当前修改，再锁定日记。'});return;}try{await request('/api/session',{method:'DELETE'});window.location.reload();}catch{setStatus({kind:'error',text:'暂时无法锁定，请重试。'});}}}>锁定</Button></span></header>
    <main className="main-wrap">
      <Tabs value={tab} onValueChange={value=>setTab(String(value))}>
        <TabsList className="app-tabs"><TabsTrigger value="record">每天记录</TabsTrigger><TabsTrigger value="trends">趋势对比</TabsTrigger><TabsTrigger value="history">记录历史</TabsTrigger><TabsTrigger value="guide">为什么</TabsTrigger></TabsList>
        {status&&<div role={status.kind==='error'?'alert':'status'} className={`feedback ${status.kind}`}>{status.kind==='ok'&&<Check size={18}/>}<span>{status.text}</span>{status.kind==='error'&&!ready&&signedIn&&<Button variant="outline" onClick={()=>void load()} disabled={loading}>重新读取</Button>}</div>}
        <TabsContent value="record">
          <div className="page-heading"><div><p className="eyebrow">DAILY CHECK-IN</p><h1>{form.day===today?'今天，感觉怎么样？':`${dateLabel(form.day)}的记录`}</h1><p className="subtle">先记一点也可以，之后随时回来补充。</p></div><div className="date-control"><Button variant="ghost" size="icon" aria-label="前一天" disabled={!form.day||saving} onClick={()=>pickDay(shiftDay(form.day,-1))}><ChevronLeft/></Button><Input type="date" aria-label="记录日期（起床日）" value={form.day} max={today} disabled={saving} onChange={event=>{if(event.target.value&&event.target.value<=today)pickDay(event.target.value);}}/><Button variant="ghost" size="icon" aria-label="后一天" disabled={!form.day||form.day>=today||saving} onClick={()=>pickDay(shiftDay(form.day,1))}><ChevronRight/></Button>{form.day!==today&&<Button variant="ghost" onClick={()=>pickDay(today)}>今天</Button>}</div></div>
          <div className="workspace-grid">
            <section className="panel record-panel"><fieldset disabled={!signedIn||!ready||saving}>
              <div className="section-title"><Moon/><h2>昨晚到今天的睡眠</h2>{selected&&!dirty&&<span className="saved-tag"><Check size={13}/> 已记录</span>}</div>
              <div className="two-cols"><label htmlFor="sleep-time">估计入睡<Input id="sleep-time" type="time" value={form.sleepTime??''} onChange={e=>update('sleepTime',e.target.value||null)}/></label><label htmlFor="wake-time">起床<Input id="wake-time" type="time" value={form.wakeTime??''} onChange={e=>update('wakeTime',e.target.value||null)}/></label></div>
              <div className="sleep-duration"><span>{hours!==null&&hours>0?<><strong>{fmt(hours)}</strong> 小时<span className="duration-label">估计睡眠</span></>:<>填入时间，自动算时长</>}</span>{previous&&<Button type="button" variant="ghost" onClick={()=>{setForm(prev=>({...prev,sleepTime:previous.sleepTime,wakeTime:previous.wakeTime}));setDirty(true);setStatus(null);}}>用上次时间</Button>}</div>
              <p className="subtle small-note">睡眠记在起床当天。{startDay&&startDay!==form.day?'这次入睡在前一天。':''}{hours!==null&&hours>14?'时长较长，请核对时间。':''}</p>
              <div className="section-title"><Sunrise/><h2>今天午睡了吗？</h2></div>
              <div className="field-label">午睡时长<span>{form.napMinutes==null?'未记录':form.napMinutes===0?'没午睡':`${form.napMinutes} 分钟`}</span></div>
              <Choices id="nap" label="午睡时长" value={form.napMinutes??null} options={[0,10,20,30,60].map(value=>({value,label:value===0?'没午睡':`${value} 分钟`}))} onChange={value=>update('napMinutes',value)}/>
              <label className="compact-number">其他时长<Input type="number" min="0" max="1440" step="1" aria-label="自定义午睡分钟" placeholder="分钟" value={form.napMinutes??''} onChange={e=>update('napMinutes',e.target.value===''?null:Number(e.target.value))}/></label>
              {form.napMinutes!=null&&form.napMinutes>0&&<div className="nap-details"><label className="compact-number">开始时间（选填）<Input type="time" aria-label="午睡开始时间" value={form.napStartTime??''} onChange={e=>update('napStartTime',e.target.value||null)}/></label><div className="field-label">醒后一会儿的感觉<span>选填</span></div><Choices id="nap-feeling" label="午睡后感受" value={form.napFeeling??null} options={napFeelingLabels.map((label,index)=>({value:index+1,label}))} onChange={value=>update('napFeeling',value)}/></div>}
              <p className="subtle small-note">估计实际睡着的分钟数；多次小睡记总时长，开始时间记第一次。午睡单独记录，不加进上面的夜间睡眠。</p>
              <div className="section-title"><Sun/><h2>今天清醒吗？</h2></div>
              <Score id="clarity" label="整体清醒程度" value={form.clarity} onChange={value=>update('clarity',value)}/>
              <p className="subtle small-note">整体状态可以晚上再补充；刚起床时，可先在“多记一点”填写起床后清醒程度。</p>
              <label className="compact-number focus-minutes-field">专注工作分钟（插件可自动带入）<Input type="number" min="0" max="1440" step="1" aria-label="专注工作分钟" placeholder="还没记录" value={form.focusMinutes??''} onChange={e=>update('focusMinutes',e.target.value===''?null:Number(e.target.value))}/></label>
              <div className="section-title"><Activity/><h2>起床后的活动与咖啡</h2></div>
              <div className="field-label">运动<span>分钟</span></div><Choices id="exercise" label="运动分钟" value={form.exerciseMinutes} options={[0,10,20,30,60].map(value=>({value,label:value===0?'没运动':`${value} 分钟`}))} onChange={value=>update('exerciseMinutes',value)}/>
              <label className="compact-number">其他时长<Input type="number" min="0" max="1440" step="1" aria-label="自定义运动分钟" placeholder="分钟" value={form.exerciseMinutes===null?'':form.exerciseMinutes} onChange={e=>update('exerciseMinutes',e.target.value===''?null:Number(e.target.value))}/></label>
              <div className="field-label coffee-label"><Coffee size={16}/> 咖啡<span>按实际杯数记，不换算咖啡因</span></div><Choices id="coffee" label="咖啡杯数" value={form.coffeeCups} options={[0,1,2,3,4].map(value=>({value,label:value===0?'没喝':`${value} 杯`}))} onChange={value=>update('coffeeCups',value)}/>
              {form.coffeeCups!==null&&form.coffeeCups>0&&<div className="two-cols coffee-details"><label>实际杯数<Input type="number" min="1" max="30" value={form.coffeeCups} onChange={e=>update('coffeeCups',e.target.value===''?null:Number(e.target.value))}/></label><label>最后一杯<Input type="time" value={form.lastCoffeeTime??''} onChange={e=>update('lastCoffeeTime',e.target.value||null)}/></label>{form.lastCoffeeTime&&form.wakeTime&&minutes(form.lastCoffeeTime)<minutes(form.wakeTime)&&<p className="subtle midnight-note">最后一杯记为起床之后的次日凌晨。</p>}</div>}
              <details className="optional-details"><summary>多记一点 <span>情绪、学习、脑雾与晚间困意</span></summary><div className="optional-content">
                <Score id="mood" label="情绪" value={form.mood} onChange={v=>update('mood',v)} labels={['很低落','偏低落','平稳','不错','很好']}/>
                <Score id="focus" label="学习专注" value={form.focus} onChange={v=>update('focus',v)} labels={['很难','较难','一般','较好','很好']}/>
                <Score id="fog" label="脑雾程度（分数越高越明显）" value={form.brainFog} onChange={v=>update('brainFog',v)} labels={['没有','轻微','中等','明显','很重']}/>
                <div className="divider"/><p className="subtle">想知道什么时候开始变慢，可以补记下面三项。</p>
                <Score id="morning" label="起床后 1 小时左右" value={form.morningClarity} onChange={v=>update('morningClarity',v)}/>
                <Score id="afternoon" label="起床后 4–6 小时" value={form.afternoonClarity} onChange={v=>update('afternoonClarity',v)}/>
                <Score id="evening" label="晚间清醒程度" value={form.eveningClarity} onChange={v=>update('eveningClarity',v)}/>
                <div className="two-cols"><label>今晚首次明显困意<Input type="time" value={form.sleepyTime??''} onChange={e=>update('sleepyTime',e.target.value||null)}/></label><label>睡眠中醒着多久（分钟）<Input type="number" min="0" max="1440" placeholder="不清楚就留空" value={form.nightAwakeMinutes??''} onChange={e=>update('nightAwakeMinutes',e.target.value===''?null:Number(e.target.value))}/></label></div>
                <label className="notes-label">备注<Textarea placeholder="例如：21 点洗澡后困，后来又清醒；睡醒不解乏。" maxLength={1000} value={form.notes} onChange={e=>update('notes',e.target.value)}/></label>
              </div></details>
              <Button type="button" className="save-button" onClick={()=>void save()}>{saving?<><LoaderCircle className="spin"/> 正在保存…</>:<><Save size={18}/>{selected?'保存修改':'保存这一天'}</>}</Button>
            </fieldset><p className="save-hint">{loading?'正在读取记录…':!signedIn?'登录后即可保存。':dirty?'尚未保存 · 草稿暂存在本次浏览器会话中':'保存后，可在其他设备登录查看。'}</p></section>
            <aside><section className="insight-panel"><BarChart3 size={24}/><div className="aside-title"><h2>最近 7 天</h2><span>{recent.length} 天记录</span></div><div className="week-dots">{today&&Array.from({length:7},(_,i)=>shiftDay(today,i-6)).map(day=>{const item=entries.find(e=>e.day===day);return <button key={day} type="button" aria-label={`${dateLabel(day)}${item?'，已记录':'，未记录'}`} onClick={()=>pickDay(day)} className={item?'has-record':''}><span>{['日','一','二','三','四','五','六'][new Date(`${day}T12:00:00`).getDay()]}</span><span className="day-dot">{item?<Check size={14}/>:day.slice(8)}</span></button>;})}</div>
              {recent.length?<div className="weekly-stats"><div><strong>{fmt(mean(recent.map(sleepHours)))}</strong><span>小时 · 平均估计睡眠</span></div><div><strong>{fmt(mean(recent.map(e=>e.clarity)))}</strong><span>/ 5 · 平均清醒程度</span></div><div><strong>{fmt(mean(recent.map(e=>e.focusMinutes)),0)}</strong><span>分钟 · 平均专注工作</span></div></div>:<div className="aside-empty"><p>不需要完美的一天，<br/>先留下一条真实记录。</p><p>这里会逐渐出现你的睡眠与清醒变化。</p></div>}<Button variant="ghost" className="aside-link" onClick={()=>setTab('trends')}>查看趋势 <ArrowUpRight size={16}/></Button></section>
              <section className="quiet-note"><CircleHelp size={19}/><div><h3>观察变化，不急着下结论</h3><p>同样睡 8 小时，感觉也可能不同。记录能帮助分清时长、时间与白天习惯。</p><button type="button" onClick={()=>setTab('guide')}>看看为什么 <ArrowUpRight size={13}/></button></div></section>
              <section className="health-note"><p>如果睡够仍长期不解乏、影响学习生活，可以带日记就诊评估。单凭打鼾的音量和频率，不能判断是否存在睡眠呼吸暂停。</p></section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="trends"><Trends entries={entries} today={today} period={period} setPeriod={setPeriod}/></TabsContent>
        <TabsContent value="history"><div className="page-heading"><div><p className="eyebrow">YOUR JOURNAL</p><h1>记录历史</h1><p className="subtle">{entries.length} 天记录 · 点击编辑即可补充。</p></div><Button variant="outline" className="action-button" disabled={!entries.length} onClick={exportData}><Download/> 导出 CSV</Button></div>{entries.length?<div className="history-list">{entries.map(entry=><article className="history-row" key={entry.day}><div className="history-date"><strong>{dateLabel(entry.day)}</strong><span>{entry.day.slice(0,4)}{entry.day===today?' · 今天':''}</span></div><div className="history-values"><span><Moon size={16}/>{entry.sleepTime??'—'} → {entry.wakeTime??'—'}<small>{fmt(sleepHours(entry))} 小时</small></span><span><Sun size={16}/>清醒 {entry.clarity??'—'}/5</span><span><Activity size={16}/>{entry.exerciseMinutes===null?'未记运动':`${entry.exerciseMinutes} 分钟`}</span><span><Coffee size={16}/>{entry.coffeeCups===null?'未记咖啡':`${entry.coffeeCups} 杯`}</span><span><BookOpen size={16}/>专注 {entry.focusMinutes===null?'—':`${entry.focusMinutes} 分钟`}</span><span><Sunrise size={16}/>{entry.napMinutes==null?'未记午睡':entry.napMinutes===0?'没午睡':`午睡 ${entry.napMinutes} 分钟`}{entry.napMinutes!=null&&entry.napMinutes>0&&<small>{[entry.napStartTime?`${entry.napStartTime} 开始`:null,entry.napFeeling?napFeelingLabels[entry.napFeeling-1]:null].filter(Boolean).join(' · ')}</small>}</span>{entry.notes&&<p>{entry.notes}</p>}</div><div className="row-actions"><Button aria-label={`编辑 ${entry.day}`} variant="ghost" size="icon" onClick={()=>{pickDay(entry.day);setTab('record');window.scrollTo({top:0,behavior:'smooth'});}}><Pencil/></Button><Button aria-label={`删除 ${entry.day}`} variant="ghost" size="icon" onClick={()=>setDeleting(entry.day)}><Trash2/></Button></div></article>)}</div>:<Empty title="还没有保存的记录" text="从今天开始，漏记的日期也可以之后补上。" action={()=>setTab('record')}/>}</TabsContent>
        <TabsContent value="guide"><Guide/></TabsContent>
      </Tabs>
      <footer className="app-footer">清醒日记<span>记录帮助观察，不提供诊断。</span></footer>
    </main>
    <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!deleteBusy)setDeleting(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这一天的记录？</AlertDialogTitle><AlertDialogDescription>{deleting&&dateLabel(deleting)}的记录将被删除，无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteBusy}>保留记录</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleteBusy} onClick={()=>void remove()}>{deleteBusy?'正在删除…':'删除'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function Empty({title,text,action}:{title:string;text:string;action?:()=>void}){return <EmptyPrimitive className="empty-state"><BarChart3 size={34}/><h2>{title}</h2><p>{text}</p>{action&&<Button onClick={action}>记下第一天</Button>}</EmptyPrimitive>;}
function Trends({entries,today,period,setPeriod}:{entries:SavedEntry[];today:string;period:number;setPeriod:(value:number)=>void}){
  const list=useMemo(()=>today?entries.filter(e=>e.day>=shiftDay(today,1-period)&&e.day<=today):[],[entries,today,period]);
  const chart=useMemo(()=>today?Array.from({length:period},(_,i)=>{const day=shiftDay(today,i+1-period);const e=list.find(e=>e.day===day);return{day,label:day.slice(5).replace('-','/'),sleep:e?sleepHours(e):null,clarity:e?.clarity??null,mood:e?.mood??null,focus:e?.focus??null};}):[],[list,today,period]);
  const groups=[
    {title:'睡眠时长与当天清醒',labels:['少于 7 小时','7 小时及以上'],items:compareGroups(list,e=>{const h=sleepHours(e);return h===null?null:h<7?0:1;})},
    {title:'入睡时间与当天清醒',labels:['18:00–次日 01:59','02:00–05:59'],items:compareGroups(list,bedtimeGroup)},
    {title:'运动与同一天的清醒',labels:['没有运动','有运动'],items:compareGroups(list,e=>e.exerciseMinutes===null?null:e.exerciseMinutes===0?0:1)},
    {title:'咖啡与同一天的清醒',labels:['没有喝咖啡','喝了咖啡'],items:compareGroups(list,e=>e.coffeeCups===null?null:e.coffeeCups===0?0:1)},
    {title:'午睡与同一天的清醒',labels:['没午睡','有午睡'],items:compareGroups(list,napGroup)}
  ];
  return <><div className="page-heading"><div><p className="eyebrow">PATTERNS, NOT PRESSURE</p><h1>看看自己的变化</h1><p className="subtle">留空不算 0。每项只使用已经填写的记录。</p></div><Choices id="period" label="趋势范围" value={period} options={[7,14,30].map(value=>({value,label:`${value} 天`}))} onChange={value=>setPeriod(value??14)}/></div>
    {!list.length?<Empty title="趋势需要一点时间" text="保存第一天后，睡眠和清醒曲线就会从这里开始。"/>:<>
      <section className="panel chart-panel"><div className="chart-heading"><h2>睡眠与清醒</h2><div className="chart-legend"><span><i className="sleep-swatch"/>睡眠（小时）</span><span><i className="clarity-swatch"/>清醒（1–5）</span></div></div><div className="chart" role="img" aria-label="所选日期范围内，每天的估计睡眠小时数与自评清醒分数，缺失数据留空。"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{top:20,right:0,bottom:10,left:-18}}><CartesianGrid stroke="#e8edf5" vertical={false}/><XAxis dataKey="label" tick={{fontSize:12,fill:'#62718a'}} minTickGap={24} axisLine={false} tickLine={false}/><YAxis yAxisId="sleep" domain={[0,'auto']} tick={{fontSize:12,fill:'#62718a'}} axisLine={false} tickLine={false} width={45}/><YAxis yAxisId="clarity" orientation="right" domain={[0,5]} ticks={[1,3,5]} tick={{fontSize:12,fill:'#62718a'}} axisLine={false} tickLine={false} width={30}/><Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.day??''} formatter={(value,name)=>[`${Number(value).toFixed(1)}${name==='估计睡眠'?' 小时':' / 5'}`,name]} contentStyle={{borderRadius:12,border:'1px solid #dce3ef',fontSize:14}}/><Bar yAxisId="sleep" dataKey="sleep" name="估计睡眠" fill="#aec4f7" radius={[5,5,0,0]} maxBarSize={35} isAnimationActive={false}/><Line yAxisId="clarity" dataKey="clarity" name="清醒程度" stroke="#3158d5" strokeWidth={2.5} dot={{r:4,fill:'#3158d5',strokeWidth:0}} activeDot={{r:6}} connectNulls={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div><p className="subtle small-note">未填写夜间清醒分钟时，睡眠按入睡到起床的时段估计。左右刻度不同，曲线交叉没有特殊含义。</p></section>
      <FeelingsChart data={chart}/><section className="time-profile panel"><h2>一天里，什么时候更清醒？</h2><div className="profile-bars">{(['morningClarity','afternoonClarity','eveningClarity'] as const).map((key,index)=>{const value=mean(list.map(e=>e[key]));const count=list.filter(e=>e[key]!==null).length;return <div key={key}><span>{['起床后 1 小时','起床后 4–6 小时','晚间'][index]}</span><div className="profile-track"><div style={{width:value===null?'0%':`${value/5*100}%`}}/></div><strong>{fmt(value)}<small> / 5 · {count} 天</small></strong></div>;})}</div><p className="subtle small-note">来自“多记一点”的自评；三个时段可能有不同的记录天数。</p></section>
      <div className="comparison-heading"><h2>把两种日子放在一起</h2><p className="subtle">每组至少 3 条完整配对记录再显示均值；这只是观察，不代表因果。</p></div><div className="comparison-grid">{groups.map(group=>{const enough=group.items.every(item=>item.count>=3);return <section className="panel comparison" key={group.title}><h3>{group.title}</h3>{group.items.map((item,index)=><div className="compare-row" key={index}><div><span>{group.labels[index]}</span><small>{item.count} 天有效记录{enough?` · 平均睡眠 ${fmt(item.sleep)} 小时`:''}</small></div><strong>{enough?fmt(item.clarity):'—'}<small> / 5</small></strong></div>)}{!enough&&<p className="subtle small-note">记录还不够，先继续积累。</p>}</section>;})}</div>
      <p className="comparison-note">今天的咖啡、运动和午睡，发生在昨晚睡眠之后，不能用来解释昨晚睡得怎样。喝咖啡或午睡也可能是因为当天本来就困；清醒评分若在午睡前填写，不能反映午睡后的效果。要看午睡与当晚入睡的关系，请对照下一天记录的入睡时间。入睡时间的比较请同时看两组睡眠时长。</p>
    </>}
  </>;
}

function FeelingsChart({data}:{data:{day:string;label:string;mood:number|null;focus:number|null}[]}){
  if(!data.some(e=>e.mood!==null||e.focus!==null))return null;
  return <section className="panel time-profile"><div className="chart-heading"><h2>情绪与学习专注</h2><div className="chart-legend"><span><i style={{background:'#258d84'}}/>情绪</span><span><i style={{background:'#9367b7'}}/>学习专注</span></div></div><div className="chart" role="img" aria-label="情绪和学习专注的每日自评趋势，1 到 5 分，越高越好。"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:15,right:15,bottom:5,left:-20}}><CartesianGrid stroke="#e8edf5" vertical={false}/><XAxis dataKey="label" tick={{fontSize:12,fill:'#62718a'}} minTickGap={25} axisLine={false} tickLine={false}/><YAxis domain={[1,5]} ticks={[1,2,3,4,5]} tick={{fontSize:12,fill:'#62718a'}} axisLine={false} tickLine={false}/><Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.day??''} formatter={(value,name)=>[`${value} / 5`,name]} contentStyle={{borderRadius:12,fontSize:14}}/><Line dataKey="mood" name="情绪" stroke="#258d84" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false}/><Line dataKey="focus" name="学习专注" stroke="#9367b7" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div><p className="subtle small-note">自评 1–5 分，越高越好。没有学习的日子可留空。</p></section>;
}

function Guide(){
 return <><div className="page-heading"><div><p className="eyebrow">UNDERSTAND YOUR RHYTHM</p><h1>为什么会有这些变化？</h1><p className="subtle">用来理解记录，不用来给自己打分。</p></div></div><div className="guide-grid">
  <article className="panel guide-card"><Moon/><h2>睡多久、几点睡、睡得怎样</h2><p>多数成年人需要 7–9 小时睡眠。时长相同，睡眠是否连续、作息是否稳定，也会影响白天的状态。午夜本身没有特殊的恢复保证。</p><p>要比较早睡是否适合你，尽量保持睡眠时长接近，再观察一段时间。</p><a href="https://www.nhlbi.nih.gov/health/sleep/how-much-sleep" target="_blank" rel="noreferrer">NIH：睡眠需要多少 <ArrowUpRight/></a></article>
  <article className="panel guide-card"><Sun/><h2>累了，却又不困</h2><p>醒得越久，睡眠压力通常越高；生物钟却会在不同时间发出清醒信号。两者共同作用，就可能出现晚上先困、后来又精神。</p><p>固定起床、起床后接触自然光、睡前减少明亮灯光，有助于稳定节奏。</p><a href="https://www.nhlbi.nih.gov/health/sleep/sleep-wake-cycle" target="_blank" rel="noreferrer">NIH：睡眠与生物钟 <ArrowUpRight/></a></article>
  <article className="panel guide-card"><Coffee/><h2>喝咖啡，仍然会困</h2><p>咖啡因暂时阻挡部分困意信号，不能补回睡眠。主观上不容易睡着，也不等于思考和注意力已经恢复。</p><p>咖啡因影响可能持续到 8 小时，记录最后一杯的时间，比只记喝没喝更有帮助。</p><a href="https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits" target="_blank" rel="noreferrer">NIH：改善睡眠习惯 <ArrowUpRight/></a></article>
  <article className="panel guide-card"><Activity/><h2>运动与学习、情绪</h2><p>规律活动可以帮助睡眠和情绪。先从轻松走路开始，逐渐增加，比突然练到很累更容易坚持。</p><p>睡眠不足会影响注意力、记忆和情绪调节。把清醒、专注和情绪分别记录，能看出它们是否一起变化。</p><a href="https://www.cdc.gov/physical-activity-basics/benefits/index.html" target="_blank" rel="noreferrer">CDC：身体活动的益处 <ArrowUpRight/></a></article>
  <article className="panel guide-card"><Sunrise/><h2>午睡后，为什么感觉不一样？</h2><p>短暂午睡可能让人更清醒。若晚上不容易入睡，可以先试较早午后、10–20 分钟的小睡，再观察自己的反应。</p><p>记下开始时间、时长和醒后感受，再对照当天晚间状态与下一天记录的入睡时间。几天的差异只能提供线索，不能证明因果。</p><a href="https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits" target="_blank" rel="noreferrer">NIH：午睡与睡眠习惯 <ArrowUpRight/></a></article>
 </div><section className="panel medical-note"><BookOpen/><div><h2>把记录带去就诊，也很有用</h2><p>偶尔短暂打鼾，不能直接判断有睡眠呼吸暂停，也不能仅凭鼾声小就排除。若睡够仍长期不解乏、白天脑雾影响生活，可去睡眠门诊评估；若有人观察到呼吸停顿、喘气或你会憋醒，也请告诉医生。可从“记录历史”导出日记。</p><a href="https://www.nhlbi.nih.gov/health/sleep-apnea/symptoms" target="_blank" rel="noreferrer">NIH：睡眠呼吸暂停症状 <ArrowUpRight size={15}/></a></div></section></>;
}
