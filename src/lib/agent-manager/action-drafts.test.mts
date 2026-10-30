import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogDraftSchema, codeRepairDraftSchema, parseReviewDraft, reviewDraftHref } from './action-drafts';
import { createInvestigationReader } from './investigation-service';
import { supervisorJobMessage } from './supervisor';

test('catalog preparation creates an editable owner link without database, mailbox or network writes', async () => {
  let calls = 0;
  const reader = createInvestigationReader({ fetch: async () => { calls++; throw new Error('No request expected'); } });
  const input = { title: 'Rainbow slide', categoryId: 'water-slides', startingPrice: null, shortDescription: 'A colorful water slide.', description: 'Review product details and add a photo.' };
  const result = await reader.execute('prepare_catalog_item', input);
  assert.equal(calls, 0); assert.equal(result.prepared, true); assert.equal(result.saved, false); assert.equal(result.published, false);
  const action = reader.actions[0]; assert.equal(action.kind, 'catalog_draft');
  const url = new URL(action.href, 'https://jumpingjaxllc.com');
  assert.equal(url.pathname, '/admin/inventory');
  assert.deepEqual(parseReviewDraft(url.searchParams.get('draft'), catalogDraftSchema), input);
  const saved = supervisorJobMessage({ id: 'draft', created_at: new Date().toISOString(), result_summary: 'Draft ready to review.', payload: { message: 'Add a slide', relatedAction: action } });
  assert.deepEqual(saved?.relatedAction, action);
});

test('drafts reject unknown fields, sensitive strings, unsafe routes and malformed links', async () => {
  const base = { title: 'New item', categoryId: 'combos', startingPrice: 150, shortDescription: '', description: '' };
  for (const patch of [{ categoryId: 'unknown' }, { startingPrice: -1 }, { publicVisible: true }, { imageSrc: 'https://evil.test/x' }, { description: 'password: example' }, { description: 'customer@example.test' }]) assert.equal(catalogDraftSchema.safeParse({ ...base, ...patch }).success, false);
  for (const raw of ['{', 'x'.repeat(4001), JSON.stringify({ ...base, title: '' })]) assert.equal(parseReviewDraft(raw, catalogDraftSchema), undefined);
  const code = { description: 'Fix the office email print clipping', pagePath: '/admin/invoices/inbox/print', expectedText: 'Office email' };
  const url = new URL(reviewDraftHref('code', code), 'https://jumpingjaxllc.com');
  assert.equal(url.hash, '#code-repairs'); assert.deepEqual(parseReviewDraft(url.searchParams.get('draft'), codeRepairDraftSchema), code);
  for (const pagePath of ['//evil.test', '/admin?token=secret', '/admin/../api', 'https://evil.test']) assert.equal(codeRepairDraftSchema.safeParse({ ...code, pagePath }).success, false);
  const reader = createInvestigationReader();
  assert.equal((await reader.execute('prepare_code_repair', code)).queued, false);
  assert.equal(reader.actions.length, 1);
});
