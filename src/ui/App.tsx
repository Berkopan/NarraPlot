import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createExampleProject,
  parseProjectJSON,
  replaceData,
  validateProject,
} from '../story/model';
import type { Scene, StoryProject, Theme } from '../story/model';
import { ARTBOARD, formatValue, renderSceneSVG } from '../render/svg';
import { downloadBlob, exportHTML, exportPNG, exportSVG, safeFilename } from '../render/export';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { ImportDialog } from './ImportDialog';
import { DraftControls } from './DraftControls';
import { useBrowserDraft } from './useBrowserDraft';

const SCENE_LABELS = ['Set the scene', 'Find the focus', 'Leave a takeaway'];
const SCENE_HINTS = [
  'Show the whole picture.',
  'Direct the eye to one point.',
  'Leave your reader with a thought.',
];

export function App() {
  const [project, setProject] = useState<StoryProject>(createExampleProject);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialog, setDialog] = useState<'import' | 'export' | 'help' | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const draft = useBrowserDraft(project, (saved) => {
    setProject(saved);
    setActiveIndex(0);
    setPlaying(false);
  });
  const openFile = useRef<HTMLInputElement>(null);
  const scene = project.scenes[activeIndex]!;
  const svg = useMemo(() => renderSceneSVG(project, scene.id), [project, scene.id]);
  const normalizedProject = (value: StoryProject) => ({
    ...value,
    title: value.title.trim() || 'Untitled story',
  });
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setActiveIndex((index) => (index + 1) % 3), 4000);
    return () => window.clearInterval(id);
  }, [playing]);

  const patchScene = (patch: Partial<Omit<Scene, 'id'>>) =>
    setProject((current) => ({
      ...current,
      scenes: current.scenes.map((item, index) =>
        index === activeIndex ? { ...item, ...patch } : item,
      ) as StoryProject['scenes'],
    }));
  const selectScene = (index: number) => {
    setActiveIndex(index);
    setPlaying(false);
  };
  const toast = (message: string, error = false) => setNotice({ message, error });
  const saveProject = () => {
    try {
      const valid = validateProject(normalizedProject(project));
      downloadBlob(
        new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' }),
        `${safeFilename(valid.title)}.narraplot.json`,
      );
      toast('Project saved. Reopen the JSON file to keep editing.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the project.', true);
    }
  };
  const loadProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 800_000) throw new Error('Choose a NarraPlot project smaller than 800 KB.');
      const next = parseProjectJSON(await file.text());
      setProject(next);
      setActiveIndex(0);
      setPlaying(false);
      toast('Project opened. You can continue editing.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open the project.', true);
    }
  };
  const publish = async (format: 'png' | 'svg' | 'html') => {
    setExporting(true);
    try {
      const valid = validateProject(normalizedProject(project));
      if (format === 'png') await exportPNG(valid, scene.id);
      else if (format === 'svg') exportSVG(valid, scene.id);
      else exportHTML(valid);
      toast(
        format === 'html'
          ? 'HTML story downloaded. Open the file in a browser to play all three scenes.'
          : `${format.toUpperCase()} downloaded for scene ${activeIndex + 1}.`,
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'The export did not finish. Please try again.',
        true,
      );
    } finally {
      setExporting(false);
    }
  };
  const pendingReview = project.scenes.filter((item) => item.needsReview).length;

  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          aria-label="NarraPlot editor"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>NarraPlot</span>
          <span className="alpha-tag">ALPHA</span>
        </a>
        <span className="header-note">
          <span className="status-dot" />
          Your data stays in your browser
        </span>
        <div className="header-actions">
          <button
            className="button quiet"
            aria-label="Open project"
            onClick={() => openFile.current?.click()}
          >
            <Icon name="folder" />
            <span>Open project</span>
          </button>
          <button className="button secondary" aria-label="Save project" onClick={saveProject}>
            <Icon name="save" />
            <span>Save project</span>
          </button>
          <button
            className="icon-button help-button"
            aria-label="How NarraPlot works"
            onClick={() => setDialog('help')}
          >
            <Icon name="help" size={20} />
          </button>
        </div>
        <input
          ref={openFile}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            void loadProject(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </header>

      <main className="workspace">
        <div className="project-header">
          <div>
            <div className="project-breadcrumb">
              YOUR STORY<span>/</span>THREE SCENES, ONE POINT
            </div>
            <input
              className="project-title"
              aria-label="Project title"
              value={project.title}
              maxLength={80}
              onChange={(event) =>
                setProject((current) => ({ ...current, title: event.target.value }))
              }
              onBlur={() => setProject((current) => normalizedProject(current))}
            />
            <p className="save-state">
              <Icon name={draft.saved && !draft.error ? 'check' : 'save'} size={13} />
              {draft.status}
              <span className="dot-separator">·</span>
              {project.points.length} data points
            </p>
          </div>
          <button
            className="button primary export-top"
            onClick={() => {
              setPlaying(false);
              setDialog('export');
            }}
          >
            <Icon name="download" />
            Export story
            <Icon name="arrow" size={16} />
          </button>
        </div>

        <DraftControls draft={draft} />

        <div className="editor-grid">
          <aside className="panel data-panel" aria-label="Data and appearance">
            <div className="panel-heading">
              <span className="eyebrow">01 / YOUR DATA</span>
              <span className="count-pill">{project.points.length} rows</span>
            </div>
            <h2>The starting point.</h2>
            <p className="panel-description">A small table. Something to say.</p>
            <button
              className="button secondary full-width import-button"
              onClick={() => {
                setPlaying(false);
                setDialog('import');
              }}
            >
              <Icon name="upload" size={17} />
              Paste or import CSV
            </button>
            <div className="data-card">
              <div className="data-card-top">
                <span>LABEL</span>
                <span>VALUE</span>
              </div>
              <div className="data-card-body">
                <table className="data-table">
                  <tbody>
                    {project.points.map((point) => (
                      <tr
                        key={point.label}
                        className={point.label === scene.highlight ? 'highlight-row' : ''}
                      >
                        <td>
                          <button
                            title={`Highlight ${point.label}`}
                            className="data-label"
                            onClick={() =>
                              patchScene({
                                highlight: scene.highlight === point.label ? null : point.label,
                              })
                            }
                          >
                            {point.label}
                            <span className="row-marker" />
                          </button>
                        </td>
                        <td title={formatValue(point.value)}>{formatValue(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="data-card-footer">
                <span>{project.unit || 'No unit set'}</span>
                <span>Click a label to highlight</span>
              </div>
            </div>
            <div className="panel-section">
              <p className="field-label">CHART TYPE</p>
              <div className="chart-toggle" role="group" aria-label="Chart type">
                <button
                  className={project.chartType === 'bar' ? 'selected' : ''}
                  aria-pressed={project.chartType === 'bar'}
                  onClick={() => setProject((current) => ({ ...current, chartType: 'bar' }))}
                >
                  <Icon name="bars" size={19} />
                  Bar
                </button>
                <button
                  className={project.chartType === 'line' ? 'selected' : ''}
                  aria-pressed={project.chartType === 'line'}
                  onClick={() => setProject((current) => ({ ...current, chartType: 'line' }))}
                >
                  <Icon name="line" size={19} />
                  Line
                </button>
              </div>
              {project.chartType === 'line' && (
                <p className="field-note">Points follow your table order at equal spacing.</p>
              )}
            </div>
            <div className="panel-section">
              <p className="field-label">PALETTE</p>
              <div className="theme-options">
                {(['terracotta', 'lagoon'] as Theme[]).map((theme) => (
                  <button
                    key={theme}
                    className={`theme-option ${project.theme === theme ? 'selected' : ''}`}
                    aria-pressed={project.theme === theme}
                    onClick={() => setProject((current) => ({ ...current, theme }))}
                  >
                    <span className={`swatches ${theme}`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>{theme === 'terracotta' ? 'Terracotta' : 'Lagoon'}</span>
                    {project.theme === theme && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="source-note">
              <span className="field-label">SOURCE / CONTEXT</span>
              <p>{project.source || 'No source added yet.'}</p>
              <button className="text-button" onClick={() => setDialog('import')}>
                Edit data & source
                <Icon name="arrow" size={13} />
              </button>
            </div>
          </aside>

          <section className="stage-area" aria-label="Story preview">
            <div className="stage-toolbar">
              <div className="stage-label">
                <span className="tiny-square" />
                LIVE CANVAS
                <span className="stage-size">
                  {ARTBOARD.width} × {ARTBOARD.height}
                </span>
              </div>
              <button
                className={`play-button ${playing ? 'playing' : ''}`}
                onClick={() => setPlaying((current) => !current)}
              >
                <Icon name={playing ? 'pause' : 'play'} size={14} />
                {playing ? 'Pause' : 'Preview story'}
              </button>
            </div>
            <div className="canvas-surround">
              <div
                className={`artboard ${playing ? 'is-playing' : ''}`}
                data-testid="story-canvas"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
            {scene.needsReview && (
              <div className="review-banner" role="status">
                <span>
                  <strong>New data, old words.</strong> Check this scene’s headline, caption and
                  highlight before you export.
                </span>
                <button
                  className="button review-confirm"
                  onClick={() => patchScene({ needsReview: false })}
                >
                  <Icon name="check" size={15} />
                  I’ve reviewed this scene
                </button>
              </div>
            )}
            <div className="storyboard-heading">
              <span className="eyebrow">02 / THE STORYBOARD</span>
              <span>Give each scene a job.</span>
            </div>
            <div className="scene-strip" role="group" aria-label="Story scenes">
              {project.scenes.map((item, index) => (
                <button
                  className={`scene-card ${index === activeIndex ? 'active' : ''}`}
                  key={item.id}
                  aria-pressed={index === activeIndex}
                  onClick={() => selectScene(index)}
                >
                  <span className="scene-card-top">
                    <span className="scene-number">0{index + 1}</span>
                    {item.needsReview ? (
                      <span className="review-dot" title="Needs review" />
                    ) : index === activeIndex ? (
                      <span className="editing-label">EDITING</span>
                    ) : (
                      <Icon name="arrow" size={14} />
                    )}
                  </span>
                  <strong>{SCENE_LABELS[index]}</strong>
                  <span className="scene-card-caption">{SCENE_HINTS[index]}</span>
                  <span className="scene-mini-bars" aria-hidden="true">
                    {project.points.slice(0, 6).map((point) => (
                      <i
                        key={point.label}
                        className={point.label === item.highlight ? 'focused' : ''}
                        style={{
                          height: `${8 + (Math.abs(point.value) / Math.max(1, ...project.points.map((dataPoint) => Math.abs(dataPoint.value)))) * 20}px`,
                        }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
            <div className="stage-footer">
              <span>
                <span className="status-dot" />
                Local by design. No account needed.
              </span>
              <span>A story worth sharing.</span>
            </div>
          </section>

          <aside className="panel story-panel" aria-label="Scene editor">
            <div className="panel-heading">
              <span className="eyebrow">03 / MAKE THE POINT</span>
              <span className="scene-count">0{activeIndex + 1}</span>
            </div>
            <h2>{SCENE_LABELS[activeIndex]}</h2>
            <p className="panel-description">{SCENE_HINTS[activeIndex]}</p>
            <label className="field scene-title-field">
              <span className="field-label">HEADLINE</span>
              <textarea
                aria-label="Scene headline"
                value={scene.title}
                maxLength={110}
                rows={3}
                onChange={(event) => patchScene({ title: event.target.value })}
                placeholder="What does this scene say?"
              />
              <span className="character-count">{scene.title.length} / 110</span>
            </label>
            <label className="field">
              <span className="field-label">CAPTION</span>
              <textarea
                aria-label="Scene caption"
                value={scene.caption}
                maxLength={220}
                rows={4}
                onChange={(event) => patchScene({ caption: event.target.value })}
                placeholder="Add a little context."
              />
              <span className="character-count">{scene.caption.length} / 220</span>
            </label>
            <label className="field highlight-field">
              <span className="field-label">HIGHLIGHT A POINT</span>
              <select
                aria-label="Highlighted point"
                value={scene.highlight ?? ''}
                onChange={(event) => patchScene({ highlight: event.target.value || null })}
              >
                <option value="">Show all points equally</option>
                {project.points.map((point) => (
                  <option key={point.label} value={point.label}>
                    {point.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="editor-tip">
              <span className="tip-symbol">↗</span>
              <p>
                {activeIndex === 0
                  ? 'Start wide. Help the reader see the shape before you ask them to notice a detail.'
                  : activeIndex === 1
                    ? 'One point is often enough. Use the headline to explain why it deserves attention.'
                    : 'Finish with something the numbers support. A good takeaway does not need a grand claim.'}
              </p>
            </div>
            <button
              className="next-scene text-button"
              onClick={() => selectScene((activeIndex + 1) % 3)}
            >
              {activeIndex < 2 ? 'Next scene' : 'Back to the overview'}
              <Icon name="arrow" size={16} />
            </button>
          </aside>
        </div>
      </main>
      <footer className="app-footer">
        <span>
          NarraPlot<span className="dot-separator">·</span>An open-source work in progress.
        </span>
        <button
          className="text-button"
          onClick={() => {
            if (
              window.confirm(
                'Replace your open story with the example? Save a project file first to keep your work. If remembering is on, its saved copy will update too.',
              )
            ) {
              setProject(createExampleProject());
              setActiveIndex(0);
              setPlaying(false);
            }
          }}
        >
          Reset to example
        </button>
      </footer>

      {dialog === 'import' && (
        <ImportDialog
          project={project}
          onClose={() => setDialog(null)}
          onImport={(points, unit, source) => {
            try {
              const next = replaceData(project, points, unit, source);
              setProject(next);
              setPlaying(false);
              setActiveIndex(0);
              setDialog(null);
              toast('Data updated. Review all three scenes before publishing.');
            } catch (error) {
              toast(
                error instanceof Error ? error.message : 'The data could not be imported.',
                true,
              );
            }
          }}
        />
      )}
      {dialog === 'export' && (
        <Dialog
          title="Ready to leave the canvas?"
          eyebrow="YOUR STORY, YOUR FILES."
          onClose={() => {
            if (!exporting) setDialog(null);
          }}
        >
          <p className="dialog-intro">
            Export scene {activeIndex + 1} as an image, or take all three scenes with you as a
            self-contained HTML story.
          </p>
          {pendingReview > 0 && (
            <p className="notice notice-warning">
              {pendingReview} {pendingReview === 1 ? 'scene needs' : 'scenes need'} review after a
              data change. Confirm each affected scene on the canvas before exporting it.
            </p>
          )}
          <div className="export-options">
            {(
              [
                {
                  format: 'png',
                  icon: 'image',
                  title: 'PNG image',
                  detail: 'Current scene · 2400 × 1520 px',
                  blocked: scene.needsReview,
                },
                {
                  format: 'svg',
                  icon: 'code',
                  title: 'SVG artwork',
                  detail: 'Current scene · scalable, editable vector',
                  blocked: scene.needsReview,
                },
                {
                  format: 'html',
                  icon: 'globe',
                  title: 'HTML story',
                  detail: 'All 3 scenes · opens offline in a browser',
                  blocked: pendingReview > 0,
                },
              ] as const
            ).map((option) => (
              <button
                key={option.format}
                className="export-option"
                disabled={exporting || option.blocked}
                onClick={() => {
                  void publish(option.format);
                }}
              >
                <span className="export-icon">
                  <Icon name={option.icon as IconName} size={22} />
                </span>
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.detail}</small>
                </span>
                <Icon name="download" size={18} />
              </button>
            ))}
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={project.showBrand}
              onChange={(event) =>
                setProject((current) => ({ ...current, showBrand: event.target.checked }))
              }
            />
            Include the small NarraPlot credit
          </label>
          <div className="export-footnote">
            <span className="alpha-tag">ALPHA</span>
            <p>
              Video export is not available yet. These exports use the same scene drawing as the
              preview. Save a project JSON to keep an editable copy.
            </p>
          </div>
          {exporting && (
            <p className="export-progress" role="status">
              Preparing your file…
            </p>
          )}
        </Dialog>
      )}
      {dialog === 'help' && (
        <Dialog
          title="A little data. A clearer story."
          eyebrow="WELCOME TO NARRAPLOT"
          onClose={() => setDialog(null)}
        >
          <div className="help-steps">
            <div>
              <span>01</span>
              <p>
                <strong>Bring a small table.</strong> Paste CSV, choose a label and a value column,
                and confirm the number format. This alpha supports up to 12 unique points.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Give each scene a job.</strong> Set the context, bring a point into focus,
                then write a takeaway the numbers support.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Make it yours and take it with you.</strong> Export PNG, SVG or a portable
                three-scene HTML story. MP4 is planned and not available in this alpha.
              </p>
            </div>
          </div>
          <div className="notice notice-info">
            <strong>Your browser is the workspace.</strong> Core editing and exporting use no
            account, API key or data upload. Turn on “Remember draft in this browser” to retain this
            story and its imported data on this device. On reopening, choose whether to restore or
            discard the saved draft. Forget draft removes the saved copy and turns remembering off;
            save a project file for a copy you control.
          </div>
          <p className="field-note">
            The starting dataset is synthetic. Line charts follow table order at equal spacing; they
            do not infer time intervals. Numeric imports never combine duplicate labels or turn
            missing cells into zero.
          </p>
          <footer className="dialog-footer">
            <span />
            <button className="button primary" onClick={() => setDialog(null)}>
              Make a story
              <Icon name="arrow" size={16} />
            </button>
          </footer>
        </Dialog>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? 'toast-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <Icon name={notice.error ? 'help' : 'check'} size={18} />
          <span>{notice.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
