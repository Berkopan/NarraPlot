# Product brief

## The promise

Make it easy to turn a small table into a visual explanation someone else can
understand and share. The first useful loop is import → edit three scenes → export
→ reopen the project later.

NarraPlot should feel like a focused editor. A person should see a real chart on
first load, understand what to change, and receive a portable result without an
account or a required service.

## The first release

- A bounded CSV import with explicit mapping and number format.
- One series, bar and line charts, and three editable scenes.
- A common dataset, scale, and color meaning across every scene.
- Visible annotations and source information; no automatic factual claims.
- A project file that preserves editing state.
- Actual SVG, PNG, and portable HTML exports from the same renderer.

The sample dataset is synthetic and labeled as such. All feature claims in the
README should correspond to working behavior in the editor.

## What comes next

The largest open question is reliable MP4 export in a browser. Investigate the
codec, browser support, memory, audio-free playback, output dimensions, and
deterministic frame rendering with a real downloadable file before adding a UI
promise. If it needs a server or a native runtime, make that a visible product
decision. Do not label WebM as MP4.

Other improvements should come from reproduced friction in the first useful loop:
number-format clarity, text fitting, keyboard access, project compatibility, and
export parity. Increasing chart count is secondary to making the existing path
trustworthy and pleasant.

## Quality means

The dataset still means the same thing after import. A highlighted point really
exists. Text is readable in the export. The reader can understand the unit and
source. The user can reopen their work. A failed action explains how to recover.

## Distribution

Show the working product: a short before/after example, a real exported story, and
an honest description of the current limits. Use data with clear provenance or
explicitly synthetic examples. Publish when there is something worth showing;
do not generate filler releases, promotional issues, or artificial engagement.
