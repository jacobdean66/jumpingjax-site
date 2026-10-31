import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupervisorComposer } from './SupervisorComposer';

test('the composer offers phone photo selection, previews, removal and picture-only Send', () => {
  const props = { message: '', busy: false, preparingPictures: false, pictures: [], onAddPictures: () => {}, onRemovePicture: () => {}, onChange: () => {}, onSubmit: () => {} };
  const blank = renderToStaticMarkup(React.createElement(SupervisorComposer, props));
  assert.match(blank, /type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(blank, /Attach picture/);
  assert.match(blank, /<button disabled=""[^>]*>Send<\/button>/);
  const withPictures = { ...props, pictures: [{ dataUrl: 'data:image/jpeg;base64,YWJj' }] };
  const attached = renderToStaticMarkup(React.createElement(SupervisorComposer, withPictures));
  assert.match(attached, /Picture 1 preview/);
  assert.match(attached, /Remove picture 1/);
  assert.doesNotMatch(attached, /<button disabled=""[^>]*>Send<\/button>/);
  const preparing = renderToStaticMarkup(React.createElement(SupervisorComposer, { ...withPictures, busy: true, preparingPictures: true }));
  assert.match(preparing, /<button disabled=""[^>]*>Preparing picture…<\/button>/);
  assert.match(preparing, /<button type="button" disabled=""[^>]*>Remove picture 1/);
});
