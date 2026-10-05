import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { searchInvitationWorkflow, confirmInvitationWorkflow } from './workflow';
import { readConfirmedTheme, readThemeSelection } from './theme-token';
import { themeInterpretations, themeCatalogQuery } from './theme-interpretations';
import { sourceImages } from './theme-search-chat-core';
import { withThemeProviderRetry } from './provider-retry';
import { PartyInvitationCard } from '../../../components/facility-parties/PartyInvitationCard';
import { buildFullInvitationEmailHtml } from './email-html';
import { POST as book } from '../../../app/api/facility/book/route';
import { NextRequest } from 'next/server';
import { listPrivateSlotDispositions } from '../availability';

test('broad K-pop has distinct explicit interpretations; publisher images supplement metadata', () => {
  assert.deepEqual(themeInterpretations({query:'K-pop',refinements:[],rejected:[]}), ['General K-pop music party','KPop Demon Hunters animated movie characters']);
  assert.equal(themeInterpretations({query:'KPop Demon Hunters characters',refinements:[],rejected:[]}).length,0);
  assert.equal(themeCatalogQuery({query:'KPop Demon Hunters characters',refinements:[],rejected:[]}), 'kpop demon hunters');
  assert.equal(themeCatalogQuery({query:'K-pop',refinements:['KPop Demon Hunters animated movie characters'],rejected:[]}), 'kpop demon hunters');
  assert.equal(themeCatalogQuery({query:'K-pop',refinements:['KPop Demon Hunters animated movie characters','Rumi'],rejected:[]}), 'kpop demon hunters rumi');
  assert.deepEqual(sourceImages('<script type="application/ld+json">{"@type":"Movie","image":"/characters.png"}</script><img alt="KPop Demon Hunters movie characters" src="/cast.png">','https://example.com/movie'),['https://example.com/cast.png','https://example.com/characters.png']);
  assert.deepEqual(sourceImages('<img alt="Characters at a party" src="https://127.0.0.1/secret">','https://example.com'),[]);
});

test('transient 429 retries once with bounded delay; quota and authentication failures do not retry', async () => {
  let calls=0;const busy=Object.assign(new Error('Do not log this provider body'),{status:429,headers:new Headers({'retry-after':'1'})});
  const result=await withThemeProviderRetry(async()=>{if(++calls===1)throw busy;return 'verified';},AbortSignal.timeout(5000),'search',async ms=>{assert.equal(ms,1000);});
  assert.equal(result,'verified');assert.equal(calls,2);
  for(const error of [Object.assign(new Error('secret'),{status:401}), Object.assign(new Error('secret'),{status:429,type:'insufficient_quota'}), Object.assign(new Error('secret'),{status:429,headers:new Headers({'retry-after':'120'})})]) {
    calls=0;await assert.rejects(withThemeProviderRetry(async()=>{calls++;throw error;},AbortSignal.timeout(5000),'search',async()=>{}));assert.equal(calls,1);
  }
});

test('search rate limits wait for the real provider window, including wrapped quota errors', async () => {
  for (const [headers, expected] of [[new Headers(),30000],[new Headers({'retry-after':'30'}),30000],[new Headers({'retry-after':'60'}),60000]] as const) {
    let calls=0;
    const result=await withThemeProviderRetry(async()=>{if(++calls===1)throw Object.assign(new Error('private'),{status:429,headers});return 'ok';},AbortSignal.timeout(1000),'search',async delay=>{assert.equal(delay,expected);});
    assert.equal(result,'ok'); assert.equal(calls,2);
  }
  let calls=0;
  await assert.rejects(withThemeProviderRetry(async()=>{calls++;throw Object.assign(new Error('private'),{status:429,providerErrorType:'insufficient_quota'});},AbortSignal.timeout(1000),'search',async()=>{}));
  assert.equal(calls,1);
});

test('publisher logos and small metadata previews cannot hide real inline character images', () => {
  const page='<head><meta property="og:image" content="/logo.png"></head><img alt="Menu navigation badge" src="/badges.svg"><img alt="Sheriff Woody character image" src="/woody.jpg"><img alt="Buzz Lightyear character image" src="/buzz.jpg">';
  assert.deepEqual(sourceImages(page,'https://example.com/movie'),['https://example.com/woody.jpg','https://example.com/buzz.jpg']);
  assert.deepEqual(sourceImages('<meta property="og:image" content="/logo.png"><img alt="" data-src="/character_head.jpg" data-image-dimensions="1500x897">','https://example.com/movie'),['https://example.com/character_head.jpg','https://example.com/logo.png']);
  assert.deepEqual(sourceImages('<img alt="" data-src="https://127.0.0.1/private" width="1500" height="897">','https://example.com/movie'),[]);
});

test('catalog lookup, explicit confirmation, three layouts and actual booking readback preserve frozen artwork', async context => {
  const keys=['INVITATION_THEME_TOKEN_SECRET','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','AGENT_ALLOW_PROCESS_LOCAL_PROTECTION'];const saved=keys.map(k=>process.env[k]);
  Object.assign(process.env,{INVITATION_THEME_TOKEN_SECRET:'test-only-signing-secret-at-least-32-characters',NEXT_PUBLIC_SUPABASE_URL:'https://workflow-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',AGENT_ALLOW_PROCESS_LOCAL_PROTECTION:'1'});
  context.after(()=>keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];}));
  const bytes=await readFile('public/invitation-library/themes/princess-royal/princess.png');
  const hash=createHash('sha256').update(bytes).digest('hex');const id='b'.repeat(64);
  const asset={id,label:'KPop Demon Hunters',normalized_label:'kpop demon hunters',aliases:['kpop demon hunters'],franchise:'KPop Demon Hunters',description:'Movie character artwork test fixture',source_url:'https://example.com/movie',source_image_url:'https://example.com/movie.png',storage_path:hash+'.png',approval_status:'approved'};
  const events:string[]=[];let booking: { invitation: { confirmedTheme: { imagePath: string }; optionIndex: number } };let corrupt=false;let insertCount=0;
  context.mock.method(globalThis,'fetch',async(source:string|Request,init?:RequestInit)=>{
    const request=new Request(source,init),url=new URL(request.url);assert.equal(url.hostname,'workflow-test.supabase.co','No external provider or email traffic on catalog hits');
    if(url.pathname.endsWith('public-settings.json'))return Response.json({});
    if(url.pathname==='/rest/v1/agents')return request.method==='GET'?Response.json({id:'11111111-1111-4111-8111-111111111111'}):new Response(null,{status:204});
    if(url.pathname==='/rest/v1/agent_events'){events.push((await request.json()).event_type);return new Response(null,{status:201});}
    if(url.pathname==='/rest/v1/rpc/search_invitation_theme_assets')return Response.json([asset]);
    if(url.pathname==='/rest/v1/invitation_theme_assets')return Response.json(request.method==='PATCH'?{id}:asset);
    if(url.pathname.includes('/storage/v1/object/invitation-theme-artwork/'))return new Response(bytes,{headers:{'content-type':'image/png'}});
    if(url.pathname==='/rest/v1/rpc/create_facility_booking_atomic'){insertCount++;booking=(await request.json()).p_booking;return Response.json('22222222-2222-4222-8222-222222222222');}
    if(url.pathname==='/rest/v1/facility_bookings'){
      if(request.method==='GET'&&url.searchParams.get('select')==='invitation')return Response.json({invitation:corrupt?{}:booking.invitation});
      if(request.method==='GET')return Response.json([]);
      // Stop successful route after verified persistence, before unrelated booking side effects.
      throw Error('TEST_STOP_AFTER_VERIFIED_ROW');
    }
    throw Error('Unexpected test dependency '+url.pathname);
  });
  context.mock.method(console,'error',()=>{});
  const broad=await searchInvitationWorkflow({query:'K-pop'});assert.equal(broad.interpretations?.length,2);
  const found=await searchInvitationWorkflow({query:'KPop Demon Hunters characters'});assert.equal(found.candidates.length,1);assert.equal(readThemeSelection(found.candidates[0].selectionToken)?.candidate.imagePath,`/api/facility/invitations/artwork/${hash}`);
  await assert.rejects(confirmInvitationWorkflow({selectionToken:found.candidates[0].selectionToken,confirmed:false}));
  const confirmed=await confirmInvitationWorkflow({selectionToken:found.candidates[0].selectionToken,confirmed:true});assert.equal(readConfirmedTheme(confirmed.confirmationToken,asset.label)?.imagePath,confirmed.theme.imagePath);
  const html=confirmed.layouts.map(snapshot=>renderToStaticMarkup(React.createElement(PartyInvitationCard,{snapshot,childName:'Test Only',childAge:'7',dateLabel:'January 4, 2027',timeLabel:'2–4 PM'})));
  assert.equal(new Set(html).size,3);for(const markup of html){assert.ok(markup.includes(confirmed.theme.imagePath));assert.ok(!markup.includes('/invitations/approved/'));}
  for(const snapshot of confirmed.layouts){assert.ok(buildFullInvitationEmailHtml({snapshot,childName:'Test Only',childAge:'7',dateLabel:'January 4',timeLabel:'2–4 PM',siteUrl:'https://example.com',plainText:'Test'}).includes(confirmed.theme.imagePath));}
  const slot=listPrivateSlotDispositions('2027-01-04',120,[])[0];
  const body={party_kind:'private',room:'room-20',booking_date:'2027-01-04',start_minutes:slot.startMinutes,end_minutes:slot.endMinutes,idempotency_key:'workflow-test',parent_name:'Test Parent',email:'test@example.invalid',phone:'test',child_name:'Test Child',child_age:'7',child_gender:'Girl',drink_choice:'Water',payment_method:'Cash',party_theme:asset.label,invitation_creation_preference:'create',invitation_theme_token:confirmed.confirmationToken,invitation_option_index:2};
  await book(new NextRequest('https://example.com/api/facility/book',{method:'POST',headers:{'x-forwarded-for':'workflow-test'},body:JSON.stringify(body)}));
  assert.equal(insertCount,1);assert.equal(booking.invitation.confirmedTheme.imagePath,confirmed.theme.imagePath);assert.equal(booking.invitation.optionIndex,2);assert.ok(events.includes('invitation.booking_verified'));
  corrupt=true;const response=await book(new NextRequest('https://example.com/api/facility/book',{method:'POST',headers:{'x-forwarded-for':'workflow-test'},body:JSON.stringify(body)}));assert.equal(response.status,503);assert.equal((await response.json()).code,'invitation_verification_pending');
  for(const name of ['search_started','candidates_found','confirmation_saved','invitation_composed','failed'])assert.ok(events.includes('invitation.'+name),name);
});
