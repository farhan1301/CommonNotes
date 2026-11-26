import test from 'node:test';
import assert from 'node:assert/strict';
import { blockOf, continueList, currentBlock, indentLines, lineEndOffset, lineOffset, setBlock, toggleInline } from './format.js';

// Applies a change and returns the text with | marking the cursor (or [..] the selection).
const apply = (text, change) => {
  const out = text.slice(0, change.from) + change.insert + text.slice(change.to);
  return change.start === change.end
    ? `${out.slice(0, change.start)}|${out.slice(change.start)}`
    : `${out.slice(0, change.start)}«${out.slice(change.start, change.end)}»${out.slice(change.end)}`;
};
// "ab|c" → { text, start, end }; "a«bc»d" for selections.
const state = (s) => {
  if (s.includes('«')) {
    const start = s.indexOf('«');
    const end = s.indexOf('»') - 1;
    return { text: s.replace('«', '').replace('»', ''), start, end };
  }
  const at = s.indexOf('|');
  return { text: s.replace('|', ''), start: at, end: at };
};
const run = (s, fn, ...args) => {
  const st = state(s);
  const change = fn(st, ...args);
  return change && apply(st.text, change);
};

test('blockOf recognises every style', () => {
  assert.equal(blockOf('# T'), 'title');
  assert.equal(blockOf('## H'), 'heading');
  assert.equal(blockOf('### S'), 'subheading');
  assert.equal(blockOf('- a'), 'bullet');
  assert.equal(blockOf('  * a'), 'bullet');
  assert.equal(blockOf('3. a'), 'number');
  assert.equal(blockOf('- [ ] a'), 'check');
  assert.equal(blockOf('- [x] a'), 'check');
  assert.equal(blockOf('> q'), 'quote');
  assert.equal(blockOf('plain #text'), 'body');
  assert.equal(currentBlock(state('a\n## He|ad\nb')), 'heading');
});

test('setBlock converts, keeps the cursor on the text, and toggles off', () => {
  assert.equal(run('hel|lo', setBlock, 'heading'), '## hel|lo');
  assert.equal(run('## hel|lo', setBlock, 'subheading'), '### hel|lo');
  assert.equal(run('## hel|lo', setBlock, 'heading'), 'hel|lo');
  assert.equal(run('- [ ] mi|lk', setBlock, 'bullet'), '- mi|lk');
  assert.equal(run('|', setBlock, 'check'), '- [ ] |');
  assert.equal(run('x\n«milk\neggs»\ny', setBlock, 'check'), 'x\n«- [ ] milk\n- [ ] eggs»\ny');
  assert.equal(run('«a\nb\n\nc»', setBlock, 'number'), '«1. a\n2. b\n\n3. c»');
  assert.equal(run('«- a\n- b»', setBlock, 'bullet'), '«a\nb»');
  assert.equal(run('  - in|ner', setBlock, 'check'), '  - [ ] in|ner');
  assert.equal(run('# ti|tle', setBlock, 'body'), 'ti|tle');
});

test('setBlock, continueList and indentLines handle a leading blank line at offset 0', () => {
  assert.deepEqual(setBlock(state('|\nhello'), 'heading'), { from: 0, to: 0, insert: '## ', start: 3, end: 3 });
  assert.equal(run('|\nhello', setBlock, 'heading'), '## |\nhello');
  assert.equal(run('|\nhello', setBlock, 'check'), '- [ ] |\nhello');
  assert.equal(run('«\n»hello', setBlock, 'bullet'), '«- »\nhello');
  assert.equal(run('«\nhello»', setBlock, 'bullet'), '«\n- hello»');
  assert.equal(run('«\n- a»', indentLines), '  «\n  - a»');
  assert.equal(run('|\n- item', continueList), null);
  assert.equal(run('\n- |', continueList), '\n|');
  assert.equal(currentBlock(state('|\n## heading')), 'body');
});

test('toggleInline wraps, unwraps and inserts', () => {
  assert.equal(run('say «hi» now', toggleInline, 'bold'), 'say **«hi»** now');
  assert.equal(run('say **«hi»** now', toggleInline, 'bold'), 'say «hi» now');
  assert.equal(run('say «**hi**» now', toggleInline, 'bold'), 'say «hi» now');
  assert.equal(run('a|b', toggleInline, 'italic'), 'a_|_b');
  assert.equal(run('«done»', toggleInline, 'strike'), '~~«done»~~');
});

test('toggleInline leaves surrounding whitespace outside the markers', () => {
  assert.equal(run('say« hello »again', toggleInline, 'bold'), 'say **«hello»** again');
  assert.equal(run('« hello» again', toggleInline, 'italic'), ' _«hello»_ again');
  assert.equal(run('«done »now', toggleInline, 'strike'), '~~«done»~~ now');
  assert.equal(run('say« **hello** »again', toggleInline, 'bold'), 'say «hello» again');
  assert.equal(run('**one**« »**two**', toggleInline, 'bold'), null);
});

test('continueList continues and ends lists', () => {
  assert.equal(run('- milk|', continueList), '- milk\n- |');
  assert.equal(run('- [x] milk|', continueList), '- [x] milk\n- [ ] |');
  assert.equal(run('9. nine|', continueList), '9. nine\n10. |');
  assert.equal(run('  - sub|', continueList), '  - sub\n  - |');
  assert.equal(run('a\n- |', continueList), 'a\n|');
  assert.equal(run('- [ ] |', continueList), '|');
  assert.equal(run('- [ ] eggs\n- [ ] |', continueList), '- [ ] eggs\n\n|');
  assert.equal(run('  - |', continueList), '- |');
  assert.equal(run('> quote|', continueList), '> quote\n> |');
  assert.equal(run('plain|', continueList), null);
  assert.equal(run('«- a»', continueList), null);
});

test('Enter before the first word splits a nonempty item and preserves its text', () => {
  assert.equal(run('- |milk', continueList), '- \n- |milk');
  assert.equal(run('9. |item\nnext', continueList), '9. \n10. |item\nnext');
  assert.equal(run('  - [x] |task', continueList), '  - [x] \n  - [ ] |task');
  assert.equal(run('> |quote', continueList), '> \n> |quote');
});

test('Enter on an empty item still exits with text on the following line', () => {
  assert.equal(run('- |\nplain', continueList), '|\nplain');
  assert.equal(run('> |\nplain', continueList), '|\nplain');
});

test('indentLines only acts on list lines', () => {
  assert.equal(run('- a|', indentLines), '  - a|');
  assert.equal(run('  - a|', indentLines, true), '- a|');
  assert.equal(run('plain|', indentLines), null);
});

test('line offsets', () => {
  const t = 'one\ntwo\nthree';
  assert.equal(lineOffset(t, 2), 4);
  assert.equal(lineEndOffset(t, 2), 7);
  assert.equal(lineEndOffset(t, 3), 13);
  assert.equal(lineOffset(t, 9), 13);
});
