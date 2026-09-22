const encoder=new TextEncoder();
export async function hashPassword(value:string){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value.trim().replaceAll('-','').replaceAll(' ','')));
  return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function signature(expires:string,secret:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const value=await crypto.subtle.sign('HMAC',key,encoder.encode(`clear-day-session:v1:${expires}`));
  return Array.from(new Uint8Array(value)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function makeSession(secret:string,now=Date.now()){
  if(secret.length<32)throw new Error('Missing session configuration');
  const expires=String(Math.floor(now/1000)+30*24*60*60);
  return `${expires}.${await signature(expires,secret)}`;
}
export async function verifySession(token:string|undefined,secret:string|undefined,now=Date.now()){
  if(!token||!secret||secret.length<32||token.length>100)return false;
  const [expires,mac,extra]=token.split('.');
  if(extra||!/^\d{10}$/.test(expires??'')||!mac||!/^[a-f0-9]{64}$/.test(mac))return false;
  if(Number(expires)<=Math.floor(now/1000)||Number(expires)>Math.floor(now/1000)+31*24*60*60)return false;
  return safeEqual(mac,await signature(expires,secret));
}
