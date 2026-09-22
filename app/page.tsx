import DiaryApp from './diary-app';
import { getDiaryUser } from '@/lib/auth';
import AccessGate from './access-gate';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getDiaryUser();
  if(!user)return <AccessGate/>;
  return <DiaryApp signedIn={true} accountKey={user.userId} />;
}
