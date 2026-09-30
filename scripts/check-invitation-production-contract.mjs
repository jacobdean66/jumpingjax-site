// Run manually with INVITATION_CANARY_TOKEN set to the existing deployment CRON_SECRET.
// The secret stays in the Authorization header and is never printed.
const base = new URL(process.argv[2] || 'https://jumpingjaxllc.com');
if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS required');
if (!process.env.INVITATION_CANARY_TOKEN) throw new Error('Set INVITATION_CANARY_TOKEN to run the authenticated live provider probe.');
try {
  const response = await fetch(new URL('/api/facility/invitations/canary',base),{ method:'POST', headers:{authorization:'Bearer '+process.env.INVITATION_CANARY_TOKEN}, signal:AbortSignal.timeout(180000) });
  const result = await response.json().catch(()=>null);
  const ok=response.ok && result?.ok === true && result.providerExercised === true && result.candidates > 0 && result.firstPartyPngs === result.candidates && result.broadInterpretations >= 2;
  console.log(JSON.stringify({ok,status:response.status,candidates:result?.candidates,firstPartyPngs:result?.firstPartyPngs,category:result?.category}));
  if(!ok)process.exitCode=1;
} catch { console.error('Live invitation contract probe could not complete.');process.exitCode=1; }
