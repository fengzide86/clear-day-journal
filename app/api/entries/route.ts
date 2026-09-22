import { getDiaryUser } from '@/lib/auth';
import { listEntries,saveEntry,deleteEntry } from '@/db/diary';
import { validateEntry,validDay } from '@/lib/diary';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
function sameOrigin(request:Request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin;}
export async function GET(){
  const user=await getDiaryUser();
  if(!user)return json({error:'请先登录，再读取记录。'},401);
  try{return json({entries:await listEntries(user.userId)});}catch{return json({error:'暂时无法读取记录，请稍后重试。'},503);}
}
export async function PUT(request:Request){
  const user=await getDiaryUser();
  if(!user)return json({error:'登录已过期，请重新登录后保存。'},401);
  if(!sameOrigin(request))return json({error:'请求来源不正确。'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'请发送 JSON 格式的记录。'},415);
  let entry;
  try{const body=await request.text();if(body.length>12000)return json({error:'记录内容过长。'},413);entry=validateEntry(JSON.parse(body));}catch(error){return json({error:error instanceof Error?error.message:'记录格式不正确。'},400);}
  try{return json({entry:await saveEntry(user.userId,entry)});}catch{return json({error:'保存失败，填写的内容仍在页面上，请重试。'},503);}
}
export async function DELETE(request:Request){
  const user=await getDiaryUser();
  if(!user)return json({error:'请重新登录。'},401);
  if(!sameOrigin(request))return json({error:'请求来源不正确。'},403);
  const day=new URL(request.url).searchParams.get('day');
  if(!validDay(day))return json({error:'日期不正确。'},400);
  try{await deleteEntry(user.userId,day);return json({deleted:day});}catch{return json({error:'删除失败，请重试。'},503);}
}
