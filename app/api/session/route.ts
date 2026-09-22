import { env } from 'cloudflare:workers';
import { hashPassword,safeEqual,makeSession } from '@/lib/session';
import { SESSION_COOKIE } from '@/lib/auth';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const sameOrigin=(request:Request)=>request.headers.get('Origin')===new URL(request.url).origin;
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'请在网站内输入访问密码。'},403);
  if(!env.DIARY_ACCESS_HASH||!env.DIARY_SESSION_SECRET)return json({error:'网站尚未准备好，请稍后再试。'},503);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'请求格式不正确。'},415);
  let password:string;
  try{const text=await request.text();if(text.length>512)return json({error:'密码格式不正确。'},400);const body=JSON.parse(text);if(typeof body.password!=='string'||body.password.length>100)throw new Error();password=body.password;}catch{return json({error:'请输入访问密码。'},400);}
  if(!safeEqual(await hashPassword(password),env.DIARY_ACCESS_HASH))return json({error:'密码不正确，请核对后重试。'},401);
  const token=await makeSession(env.DIARY_SESSION_SECRET);
  return json({unlocked:true},200,{'Set-Cookie':`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(request.url).protocol==='https:'?'; Secure':''}`});
}
export async function DELETE(request:Request){
  if(!sameOrigin(request))return json({error:'请求来源不正确。'},403);
  return json({locked:true},200,{'Set-Cookie':`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${new URL(request.url).protocol==='https:'?'; Secure':''}`});
}
