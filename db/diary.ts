import { env } from 'cloudflare:workers';
import { emptyEntry, type DiaryEntry, type SavedEntry } from '@/lib/diary';
function binding(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export async function listEntries(userId:string):Promise<SavedEntry[]> {
  const result=await binding().prepare('SELECT data, updated_at FROM diary_entries WHERE user_id = ? ORDER BY day DESC').bind(userId).all<{data:string;updated_at:string}>();
  return result.results.map(row=>{const entry=JSON.parse(row.data);return {...emptyEntry(entry.day),...entry,updatedAt:row.updated_at};});
}
export async function saveEntry(userId:string,entry:DiaryEntry):Promise<SavedEntry>{
  const updatedAt=new Date().toISOString();
  await binding().prepare('INSERT INTO diary_entries (user_id, day, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(userId,entry.day,JSON.stringify(entry),updatedAt).run();
  return {...entry,updatedAt};
}
export async function deleteEntry(userId:string,day:string){
  await binding().prepare('DELETE FROM diary_entries WHERE user_id = ? AND day = ?').bind(userId,day).run();
}
