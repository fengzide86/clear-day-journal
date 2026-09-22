import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,safeEqual,makeSession,verifySession} from '../lib/session.ts';
const secret='local-test-session-secret-32-characters-long';
test('password hash normalizes readable separators, but rejects a different password',async()=>{
 assert.equal(await hashPassword('AbCD-2345-EFGH'),await hashPassword('AbCD2345EFGH'));assert.notEqual(await hashPassword('wrong'),await hashPassword('AbCD2345EFGH'));assert.equal(safeEqual('abcd','abce'),false);
});
test('signed sessions expire and cannot be forged or reused with another secret',async()=>{
 const now=Date.now();const token=await makeSession(secret,now);assert.equal(await verifySession(token,secret,now),true);
 assert.equal(await verifySession(token,secret,now+31*86400000),false);assert.equal(await verifySession(token,secret+'x',now),false);
 assert.equal(await verifySession(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),secret,now),false);assert.equal(await verifySession(undefined,secret,now),false);assert.equal(await verifySession(token,undefined,now),false);
});
