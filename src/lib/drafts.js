/**
 * Unsaved edits, kept on this device until the server has them.
 *
 * A draft is { id, folder_id, title, content, baseVersion, updatedAt,
 * conflict? }. baseVersion is the server version the edit started from
 * (null for a note the server has never seen). The editor writes a draft on
 * every keystroke; sync.js sends drafts to Supabase and removes them once
 * saved, so nothing typed is lost when the connection drops.
 */
import { load, save } from './storage.js';
import { autoTitle, withoutImages } from './markdown.js';

const KEY = 'commonnotes:drafts';

export const allDrafts = () => load(KEY, {});
export const getDraft = (id) => allDrafts()[id] || null;

const write = (drafts) => save(KEY, drafts);

/** Stores the editor's text. Keeps the stored baseVersion if there is one. */
export const putDraft = ({ id, folder_id, title, content, baseVersion }) => {
  const drafts = allDrafts();
  const existing = drafts[id];
  drafts[id] = {
    id,
    folder_id: existing ? existing.folder_id : folder_id ?? null,
    title,
    content,
    baseVersion: existing ? existing.baseVersion : baseVersion ?? null,
    conflict: existing?.conflict || null,
    updatedAt: Date.now(),
  };
  write(drafts);
  return drafts[id];
};

/** Merges fields into a stored draft (used by sync). */
export const patchDraft = (id, patch) => {
  const drafts = allDrafts();
  if (!drafts[id]) return null;
  drafts[id] = { ...drafts[id], ...patch };
  write(drafts);
  return drafts[id];
};

/** Removes a draft; with `ifUpdatedAt`, only if nothing was typed since. */
export const removeDraft = (id, ifUpdatedAt) => {
  const drafts = allDrafts();
  if (!drafts[id]) return;
  if (ifUpdatedAt != null && drafts[id].updatedAt !== ifUpdatedAt) return;
  delete drafts[id];
  write(drafts);
};

export const isEmptyDraft = (draft) => !draft.title?.trim() && !draft.content?.trim();

/**
 * How a draft of a note the server has never seen shows in the note list.
 * The title and preview follow the database's rules (autoTitle, images as
 * their alt text), so the row doesn't change once the note is saved.
 */
export const draftListRow = (draft) => ({
  id: draft.id,
  folder_id: draft.folder_id,
  title: draft.title.trim() || autoTitle(draft.content),
  preview: withoutImages(draft.content).replace(/\s+/g, ' ').trim().slice(0, 200),
  tags: [],
  pinned: false,
  updated_at: new Date(draft.updatedAt).toISOString(),
  deleted_at: null,
  last_edited_by: 'you',
});
