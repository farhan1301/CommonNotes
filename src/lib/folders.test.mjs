import test from 'node:test';
import assert from 'node:assert/strict';
import { notesInFolder } from './folders.js';

const folders = [
  { id: 'projects', parent_id: null },
  { id: 'garden', parent_id: 'projects' },
  { id: 'plants', parent_id: 'garden' },
  { id: 'seeds', parent_id: 'plants' },
  { id: 'kitchen', parent_id: 'projects' },
];
const notes = [
  ...folders.map(({ id }) => ({ id, folder_id: id })),
  { id: 'local-draft', folder_id: 'plants' },
  { id: 'inbox', folder_id: null },
];

test('ordinary folder views, including saved views without a scope setting, show direct notes', () => {
  assert.deepEqual(notesInFolder(folders, notes, 'garden').map((n) => n.id), ['garden']);
});

test('browsing with subfolders includes nested notes and drafts and excludes other branches', () => {
  assert.deepEqual(notesInFolder(folders, notes, 'garden', true).map((n) => n.id),
    ['garden', 'plants', 'seeds', 'local-draft']);
});

test('a removed folder cannot expand a saved subtree view to unrelated notes', () => {
  const remaining = folders.filter((f) => f.id !== 'garden');
  assert.deepEqual(notesInFolder(remaining, notes, 'garden', true), []);
});
