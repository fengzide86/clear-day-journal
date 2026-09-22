import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';
import { verifySession } from './session';
export const SESSION_COOKIE='clear_day_session';
export async function getDiaryUser(){
  const jar=await cookies();
  return await verifySession(jar.get(SESSION_COOKIE)?.value,env.DIARY_SESSION_SECRET)?{userId:'personal-owner'}:null;
}
