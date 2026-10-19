import { useEffect, useRef, useState } from 'react';
import { parseProjectJSON } from '../story/model';
import type { StoryProject } from '../story/model';

// Keep the existing draft format/key so earlier alpha drafts remain recoverable.
const DRAFT_KEY = 'narraplot.draft.v1';
const REMEMBER_KEY = 'narraplot.remember-draft.v1';

type DraftState = {
  remember: boolean;
  pending: { project: StoryProject | null } | null;
  stored: boolean;
  unreadable: boolean;
  saved: boolean;
  error: string | null;
};

function readDraft(): DraftState {
  const empty: DraftState = {
    remember: false,
    pending: null,
    stored: false,
    unreadable: false,
    saved: false,
    error: null,
  };
  try {
    const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw === null) return { ...empty, remember };
    try {
      return { ...empty, remember, stored: true, pending: { project: parseProjectJSON(raw) } };
    } catch {
      // Invalid, empty and future-version drafts stay untouched until discarded.
      return { ...empty, remember, stored: true, pending: { project: null } };
    }
  } catch {
    return {
      ...empty,
      unreadable: true,
      error:
        'Browser storage is unavailable. Your story still works in this tab; save a project file to keep it.',
    };
  }
}

export function useBrowserDraft(project: StoryProject, onRestore: (value: StoryProject) => void) {
  const [state, setState] = useState(readDraft);
  const initialProject = useRef(project);
  // This gate closes synchronously before a forget/disable action touches storage.
  // A pending React effect must never recreate the draft the user just removed.
  const mayWrite = useRef(state.remember && !state.pending && !state.unreadable);

  useEffect(() => {
    if (!mayWrite.current || !state.remember || state.pending || state.unreadable) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...project, title: project.title.trim() || 'Untitled story' }),
      );
      setState((current) => ({ ...current, stored: true, saved: true, error: null }));
    } catch {
      setState((current) => ({
        ...current,
        saved: false,
        error:
          'Your latest edits could not be saved in this browser. Storage may be full or blocked. Save a project file; editing and export still work.',
      }));
    }
  }, [project, state.remember, state.pending, state.unreadable]);

  const setRemember = (remember: boolean) => {
    if (state.pending || state.unreadable) return;
    mayWrite.current = false;
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, 'true');
      else localStorage.removeItem(REMEMBER_KEY);
      mayWrite.current = remember;
      setState((current) => ({ ...current, remember, saved: false, error: null }));
    } catch {
      setState((current) => ({
        ...current,
        remember: false,
        saved: false,
        error: remember
          ? 'Your remembering choice could not be saved. Draft saving stays off; save a project file and try again.'
          : 'Remembering is off in this tab, but the browser could not save that choice. A saved draft may remain. Try Forget draft again or check your browser’s storage settings before reopening.',
      }));
    }
  };

  const forget = () => {
    mayWrite.current = false;
    let preferenceRemoved = false;
    let draftRemoved = false;
    // Try both removals: failure to remove one key must not prevent the other.
    try {
      localStorage.removeItem(REMEMBER_KEY);
      preferenceRemoved = true;
    } catch {
      /* Report the incomplete preference change below. */
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
      draftRemoved = true;
    } catch {
      /* Keep the candidate recoverable and report the incomplete deletion. */
    }
    const error = !draftRemoved
      ? `The saved draft could not be removed and may still be on this device. Remembering is off in this tab${preferenceRemoved ? '' : ', but that choice could not be saved either'}. Try again or check your browser’s storage settings.`
      : !preferenceRemoved
        ? 'The saved draft was removed, but the browser could not save your off preference. Remembering is off in this tab; try Forget draft again or check your browser’s storage settings before reopening.'
        : null;
    setState((current) => ({
      ...current,
      remember: false,
      pending: draftRemoved ? null : current.pending,
      stored: draftRemoved ? false : current.stored,
      unreadable: current.unreadable && !(draftRemoved && preferenceRemoved),
      saved: false,
      error,
    }));
  };

  const restore = () => {
    if (!state.pending?.project) return;
    if (
      project !== initialProject.current &&
      !window.confirm(
        'Restore the saved draft and replace your open story? Save a project file first to keep your current edits.',
      )
    )
      return;
    onRestore(state.pending.project);
    mayWrite.current = state.remember && !state.unreadable;
    // Loading the project does not resolve a failed storage removal or off preference.
    setState((current) => ({ ...current, pending: null, saved: false }));
  };

  const retryRead = () => {
    const next = readDraft();
    mayWrite.current = next.remember && !next.pending && !next.unreadable;
    setState(next);
  };

  const status = state.error
    ? 'Browser draft needs attention — save a project file'
    : state.pending
      ? 'Saved draft waiting — your open story is separate'
      : state.remember
        ? state.saved
          ? 'Draft saved in this browser'
          : 'Saving browser draft…'
        : state.stored
          ? 'Remembering is off — a saved draft remains'
          : 'Remembering is off — save a project file to keep this story';

  return { ...state, status, setRemember, forget, restore, retryRead };
}
