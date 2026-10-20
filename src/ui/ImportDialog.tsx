import { useMemo, useRef, useState } from 'react';
import { mapTable, NumericMappingError, parseCSV } from '../data/csv';
import type { DataPoint, Delimiter, NumberFormat } from '../data/csv';
import type { StoryProject } from '../story/model';
import { replaceData } from '../story/model';
import { formatValue } from '../render/svg';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

function quoteCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function ImportDialog({
  project,
  onClose,
  onImport,
}: {
  project: StoryProject;
  onClose: () => void;
  onImport: (points: DataPoint[], unit: string, source: string) => void;
}) {
  const [text, setText] = useState(
    `Label,Value\n${project.points.map((point) => `${quoteCell(point.label)},${point.value}`).join('\n')}`,
  );
  const [delimiter, setDelimiter] = useState<Delimiter>(',');
  const [format, setFormat] = useState<NumberFormat>('decimal-dot');
  const [labelColumn, setLabelColumn] = useState(0);
  const [valueColumn, setValueColumn] = useState(1);
  const [unit, setUnit] = useState(project.unit);
  const [source, setSource] = useState(project.source);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => {
    try {
      const table = parseCSV(text, delimiter);
      try {
        const points = mapTable(table, labelColumn, valueColumn, format);
        replaceData(project, points, unit, source);
        return { table, points, error: '', numericFindings: [], numericFailureCount: 0 };
      } catch (error) {
        return {
          table,
          points: null,
          error:
            error instanceof NumericMappingError
              ? ''
              : error instanceof Error
                ? error.message
                : 'Check the selected columns.',
          numericFindings: error instanceof NumericMappingError ? error.findings : [],
          numericFailureCount: error instanceof NumericMappingError ? error.failureCount : 0,
        };
      }
    } catch (error) {
      return {
        table: null,
        points: null,
        error: error instanceof Error ? error.message : 'Check your CSV.',
        numericFindings: [],
        numericFailureCount: 0,
      };
    }
  }, [text, delimiter, labelColumn, valueColumn, format, project, unit, source]);
  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError('');
    if (file.size > 800_000) {
      setFileError(
        'Choose a small CSV file (up to 800 KB, then 200,000 characters after decoding).',
      );
      return;
    }
    try {
      setText(await file.text());
      setLabelColumn(0);
      setValueColumn(1);
    } catch {
      setFileError('This file could not be read. Try pasting the table instead.');
    }
  };
  return (
    <Dialog
      title="Bring your own data"
      eyebrow="A SMALL TABLE. A CLEAR START."
      wide
      onClose={onClose}
    >
      <div className="import-layout">
        <div className="import-input">
          <div className="field-heading">
            <label htmlFor="csv-input">Paste a table</label>
            <button className="text-button" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} />
              Choose CSV
            </button>
          </div>
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            hidden
            ref={fileRef}
            onChange={(event) => {
              void chooseFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <textarea
            id="csv-input"
            className="csv-input"
            value={text}
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value);
              setFileError('');
            }}
          />
          <div className="field-grid">
            <label className="field">
              Separator
              <select
                aria-label="Separator"
                value={delimiter}
                onChange={(event) => {
                  setDelimiter(event.target.value as Delimiter);
                  setLabelColumn(0);
                  setValueColumn(1);
                }}
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value={'\t'}>Tab</option>
              </select>
            </label>
            <label className="field">
              Number format
              <select
                aria-label="Number format"
                value={format}
                onChange={(event) => setFormat(event.target.value as NumberFormat)}
              >
                <option value="decimal-dot">Decimal point · 1234.56</option>
                <option value="decimal-comma">Decimal comma · 1234,56</option>
              </select>
            </label>
          </div>
          <p className="field-note">
            Use a header row and up to 12 data rows. Remove thousands separators and symbols from
            numeric cells. Labels stay text, including leading zeros.
          </p>
        </div>
        <div className="import-preview">
          <p className="eyebrow">CHOOSE WHAT TO SHOW</p>
          <div className="field-grid">
            <label className="field">
              Label column
              <select
                aria-label="Label column"
                value={labelColumn}
                disabled={!result.table}
                onChange={(event) => setLabelColumn(Number(event.target.value))}
              >
                {(result.table?.headers ?? ['Label']).map((header, index) => (
                  <option key={index} value={index}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Value column
              <select
                aria-label="Value column"
                value={valueColumn}
                disabled={!result.table}
                onChange={(event) => setValueColumn(Number(event.target.value))}
              >
                {(result.table?.headers ?? ['Label', 'Value']).map((header, index) => (
                  <option key={index} value={index}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="preview-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {result.points ? (
                  result.points.map((point) => (
                    <tr key={point.label}>
                      <td>{point.label}</td>
                      <td>{formatValue(point.value)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-table">
                      A valid preview will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <label className="field">
            Unit
            <input
              value={unit}
              maxLength={40}
              placeholder="e.g. trips, %, US dollars"
              onChange={(event) => setUnit(event.target.value)}
            />
          </label>
          <label className="field">
            Source or context
            <input
              value={source}
              maxLength={160}
              placeholder="Where do these numbers come from?"
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
        </div>
      </div>
      {(fileError || result.error || result.numericFailureCount > 0) && (
        <div
          className="notice notice-error"
          role="alert"
          style={{ overflowWrap: 'anywhere' }}
        >
          {fileError ? (
            fileError
          ) : result.numericFailureCount > 0 ? (
            <>
              <p>
                {result.numericFailureCount} invalid numeric{' '}
                {result.numericFailureCount === 1 ? 'cell' : 'cells'} in the selected value column.
                Correct every value before importing; no rows have been applied.
              </p>
              <ol className="import-error-list">
                {result.numericFindings.map((finding) => (
                  <li key={finding.dataRow}>
                    <strong>
                      Data row {finding.dataRow} · {finding.valueColumn}
                    </strong>
                    <span className="import-error-cell" style={{ display: 'block' }}>
                      Cell: <code style={{ whiteSpace: 'pre-wrap' }}>{finding.rawCellPreview}</code>
                    </span>
                    <span>{finding.reason}</span>
                  </li>
                ))}
              </ol>
              {result.numericFailureCount > result.numericFindings.length && (
                <p className="import-more-errors">
                  {result.numericFailureCount - result.numericFindings.length} more numeric{' '}
                  {result.numericFailureCount - result.numericFindings.length === 1
                    ? 'failure'
                    : 'failures'}{' '}
                  not shown.
                </p>
              )}
            </>
          ) : (
            result.error
          )}
        </div>
      )}
      <div className="import-reassurance">
        <Icon name="refresh" size={16} />
        <p>
          Your titles and design stay in place. All three scenes will be marked for review so that
          old conclusions do not quietly follow new data.
        </p>
      </div>
      <footer className="dialog-footer">
        <span className="small-muted">Only the two selected columns enter the project.</span>
        <button
          className="button primary"
          disabled={!result.points || !!fileError}
          onClick={() => {
            if (result.points) onImport(result.points, unit, source);
          }}
        >
          Use this data
          <Icon name="arrow" size={17} />
        </button>
      </footer>
    </Dialog>
  );
}
