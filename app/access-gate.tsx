'use client';
import {useState} from 'react';
import {Sunrise,LockKeyhole,ArrowRight,LoaderCircle} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export default function AccessGate(){
  const[password,setPassword]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function unlock(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(20000)});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'暂时无法打开，请稍后重试。');window.location.reload();}catch(err){setError(err instanceof Error?err.message:'连接没有成功，请重试。');setBusy(false);}
  }
  return <main className="access-screen"><div className="access-card"><span className="brand-icon"><Sunrise size={30}/></span><p className="eyebrow">YOUR PRIVATE JOURNAL</p><h1>打开你的清醒日记</h1><p className="subtle">记一点睡眠、活动和每天的感觉。</p><form onSubmit={event=>void unlock(event)}><label htmlFor="access-password">访问密码<Input id="access-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="输入你的日记密码" disabled={busy}/></label>{error&&<p className="access-error" role="alert">{error}</p>}<Button type="submit" className="save-button" disabled={busy||!password.trim()}>{busy?<><LoaderCircle className="spin"/>正在打开…</>:<>进入日记<ArrowRight size={18}/></>}</Button></form><p className="access-footnote"><LockKeyhole size={14}/> 此设备 30 天内无需重复输入。</p></div></main>;
}
