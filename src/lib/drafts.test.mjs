import test from 'node:test';
import assert from 'node:assert/strict';
import { draftListRow } from './drafts.js';
import { autoTitle } from './markdown.js';

const draft = (fields) => ({ id: 'n1', folder_id: null, title: '', content: '', baseVersion: null, updatedAt: Date.UTC(2026, 10, 25), ...fields });

test('draftListRow titles an unsaved note the way the database will', () => {
  assert.equal(draftListRow(draft({ content: '- [ ] call mom\n- [ ] milk' })).title, 'call mom');
  assert.equal(draftListRow(draft({ content: '1. book flights' })).title, 'book flights');
  assert.equal(draftListRow(draft({ content: '\n## Groceries\n- milk' })).title, 'Groceries');
  const image = '![](https://abc.supabase.co/storage/v1/object/authenticated/note-images/n1/x.jpg)';
  assert.equal(draftListRow(draft({ content: `${image}\n\nTrip to Banff` })).title, 'Trip to Banff');
  const long = 'so I was thinking about switching careers into product management because I enjoy talking to customers';
  assert.equal(draftListRow(draft({ content: long })).title, autoTitle(long));
  assert.ok(draftListRow(draft({ content: long })).title.endsWith('I…'));
});

test('draftListRow keeps a typed title and leaves image URLs out of the preview', () => {
  const content = 'see ![a cat](https://abc.supabase.co/storage/v1/object/authenticated/note-images/n1/x.jpg)\n\nhere';
  const row = draftListRow(draft({ title: '  Cats ', content }));
  assert.equal(row.title, 'Cats');
  assert.equal(row.preview, 'see a cat here');
  assert.deepEqual(
    { pinned: row.pinned, deleted_at: row.deleted_at, updated_at: row.updated_at },
    { pinned: false, deleted_at: null, updated_at: '2026-11-25T00:00:00.000Z' },
  );
});
