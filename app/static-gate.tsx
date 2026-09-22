'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, LoaderCircle, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DiaryApp from './diary-app';

const ACCESS_KEY = 'clear-day-access-v1';
const PASSWORD_HASH = '94edf28c6d6da38fd35d7ad53e485307f89fbeaf120485c8d17a43f323deee71';

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value.trim().replaceAll('-', '').replaceAll(' ', ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function StaticDiaryGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const expiry = Number(localStorage.getItem(ACCESS_KEY));
      setUnlocked(Number.isFinite(expiry) && expiry > Date.now());
    } catch { setUnlocked(false); }
  }, []);

  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (await hash(password) !== PASSWORD_HASH) throw new Error('密码不正确，请核对后重试。');
      localStorage.setItem(ACCESS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
      setUnlocked(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法打开，请重试。');
    } finally { setBusy(false); }
  }

  if (unlocked) return <DiaryApp signedIn={true} accountKey="personal-owner" />;
  return <main className="access-screen"><div className="access-card">
    <span className="brand-icon"><Sunrise size={30}/></span><p className="eyebrow">YOUR PRIVATE JOURNAL</p>
    <h1>打开你的清醒日记</h1><p className="subtle">记一点睡眠、活动和每天的感觉。</p>
    <form onSubmit={event => void unlock(event)}><label htmlFor="access-password">访问密码
      <Input id="access-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="输入你的日记密码" disabled={busy}/>
    </label>{error && <p className="access-error" role="alert">{error}</p>}
    <Button type="submit" className="save-button" disabled={busy || !password.trim()}>{busy ? <><LoaderCircle className="spin"/>正在打开…</> : <>进入日记<ArrowRight size={18}/></>}</Button></form>
    <p className="access-footnote"><LockKeyhole size={14}/> 此设备 30 天内无需重复输入。</p>
  </div></main>;
}
