import type { useBrowserDraft } from './useBrowserDraft';

export function DraftControls({ draft }: { draft: ReturnType<typeof useBrowserDraft> }) {
  return (
    <section className="draft-panel" aria-label="Browser draft">
      <div className="draft-choice">
        <label>
          <input
            type="checkbox"
            checked={draft.remember}
            disabled={Boolean(draft.pending) || draft.unreadable}
            onChange={(event) => draft.setRemember(event.target.checked)}
            aria-describedby="draft-explanation"
          />
          Remember draft in this browser
        </label>
        <p id="draft-explanation">
          Stores this story and its imported data on this device. Save a project file for a copy you
          control.
        </p>
      </div>
      <div className="draft-actions">
        {draft.unreadable && (
          <button className="button secondary" onClick={draft.retryRead}>
            Retry storage access
          </button>
        )}
        {!draft.pending && (
          <button
            className="button quiet"
            onClick={draft.forget}
            disabled={!draft.stored && !draft.remember && !draft.error}
            title="Remove the saved copy and turn remembering off. Your open story stays in the editor."
          >
            Forget draft
          </button>
        )}
      </div>
      {draft.pending && (
        <div className="draft-found">
          <div>
            <h2>
              {draft.pending.project
                ? 'A saved draft is waiting.'
                : 'This saved draft could not be opened.'}
            </h2>
            {draft.pending.project ? (
              <p>
                <strong>{draft.pending.project.title}</strong> is still on this device. Restore it
                to replace the open story, or discard it and turn remembering off. Saving is paused
                until you choose.
              </p>
            ) : (
              <p>
                The draft is invalid or from an unsupported version. It stays untouched while you
                edit or export. Discard it to remember a new story.
              </p>
            )}
          </div>
          <div className="draft-actions">
            {draft.pending.project && (
              <button className="button primary" onClick={draft.restore}>
                Restore draft
              </button>
            )}
            <button className="button secondary" onClick={draft.forget}>
              Discard draft
            </button>
          </div>
        </div>
      )}
      {draft.error && (
        <p className="draft-error" role="alert">
          {draft.error}
        </p>
      )}
      {!draft.pending && !draft.remember && draft.stored && !draft.error && (
        <p className="draft-retained">
          Your earlier saved copy remains on this device. Forget draft removes it without changing
          your open story.
        </p>
      )}
    </section>
  );
}
