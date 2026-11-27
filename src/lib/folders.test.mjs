import test from 'node:test';
import assert from 'node:assert/strict';
import { folderPath, flattenTree, subtreeIds, notesInFolder } from './folders.js';

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

const namedFolders = [
  { id: '1', name: 'Work', parent_id: null },
  { id: '2', name: 'Projects', parent_id: '1' },
  { id: '3', name: 'Acme Corp', parent_id: '2' },
  { id: '4', name: 'Personal', parent_id: null },
  { id: '5', name: 'Recipes', parent_id: '4' },
  { id: '6', name: 'Archive', parent_id: '4' },
];

test('folderPath builds paths correctly from bottom to top', () => {
  assert.equal(folderPath(namedFolders, '3'), 'Work/Projects/Acme Corp');
  assert.equal(folderPath(namedFolders, '1'), 'Work');
  assert.equal(folderPath(namedFolders, null), 'Inbox');
  // Unknown ID gracefully falls back to Inbox instead of returning an empty string
  assert.equal(folderPath(namedFolders, 'unknown'), 'Inbox');
});

test('flattenTree builds a depth-first list with siblings sorted by name', () => {
  const tree = flattenTree(namedFolders);
  
  const paths = tree.map((t) => t.path);
  assert.deepEqual(paths, [
    'Personal',
    'Personal/Archive',
    'Personal/Recipes',
    'Work',
    'Work/Projects',
    'Work/Projects/Acme Corp',
  ]);
  
  const depths = tree.map((t) => t.depth);
  assert.deepEqual(depths, [0, 1, 1, 0, 1, 2]);

  const hasChildren = tree.map((t) => t.hasChildren);
  assert.deepEqual(hasChildren, [true, false, false, true, true, false]);
});

test('subtreeIds collects the given folder and all its descendants', () => {
  const getSubtree = (id) => Array.from(subtreeIds(namedFolders, id)).sort();
  
  assert.deepEqual(getSubtree('4'), ['4', '5', '6']);
  assert.deepEqual(getSubtree('1'), ['1', '2', '3']);
  assert.deepEqual(getSubtree('2'), ['2', '3']);
  // A leaf folder returns only itself
  assert.deepEqual(getSubtree('3'), ['3']);
  // A missing folder returns a Set with just that ID
  assert.deepEqual(getSubtree('99'), ['99']);
});

test('empty namedFolders array is handled by folderPath, flattenTree, and subtreeIds', () => {
  assert.equal(folderPath([], '1'), 'Inbox');
  assert.equal(folderPath([], null), 'Inbox');
  assert.deepEqual(flattenTree([]), []);
  assert.deepEqual(subtreeIds([], '1'), new Set(['1']));
});

test('orphaned namedFolders with a missing parent_id are omitted by flattenTree but resolved partially by folderPath', () => {
  const withOrphans = [
    { id: '1', name: 'Root', parent_id: null },
    { id: '2', name: 'Orphan', parent_id: 'missing' },
    { id: '3', name: 'Orphan Child', parent_id: '2' },
  ];

  assert.deepEqual(flattenTree([withOrphans[1]]), []);
  assert.deepEqual(
    flattenTree(withOrphans).map((t) => t.path),
    ['Root'],
  );
  assert.equal(folderPath(withOrphans, '2'), 'Orphan');
  assert.equal(folderPath(withOrphans, '3'), 'Orphan/Orphan Child');
});

test('cyclic parent_id pair terminates in folderPath and subtreeIds', () => {
  const cycle = [
    { id: 'a', name: 'Alpha', parent_id: 'b' },
    { id: 'b', name: 'Beta', parent_id: 'a' },
  ];

  assert.equal(folderPath(cycle, 'a'), Array(25).fill('Beta/Alpha').join('/'));
  assert.deepEqual(subtreeIds(cycle, 'a'), new Set(['a', 'b']));
});

test('flattenTree sorts sibling namedFolders case-insensitively', () => {
  const mixedCase = [
    { id: '1', name: 'zebra', parent_id: null },
    { id: '2', name: 'Banana', parent_id: null },
    { id: '3', name: 'apple', parent_id: null },
    { id: '4', name: 'Date', parent_id: null },
    { id: '5', name: 'cherry', parent_id: null },
    { id: '6', name: 'Mango', parent_id: '2' },
    { id: '7', name: 'kiwi', parent_id: '2' },
  ];

  assert.deepEqual(
    flattenTree(mixedCase).map((t) => t.path),
    ['apple', 'Banana', 'Banana/kiwi', 'Banana/Mango', 'cherry', 'Date', 'zebra'],
  );
});
