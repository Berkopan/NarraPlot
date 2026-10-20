import { assertXMLText } from './text';

export type NumberFormat = 'decimal-dot' | 'decimal-comma';
export type Delimiter = ',' | ';' | '\t';
export interface Table {
  headers: string[];
  rows: string[][];
}
export interface DataPoint {
  label: string;
  value: number;
}

export interface NumericImportFinding {
  dataRow: number;
  valueColumn: string;
  rawCellPreview: string;
  reason: string;
}

/** Invalid numeric rows are reported together, without accepting a partial import. */
export class NumericMappingError extends Error {
  constructor(
    public readonly findings: NumericImportFinding[],
    public readonly failureCount: number,
  ) {
    super(`Data row ${findings[0]?.dataRow}: ${findings[0]?.reason ?? 'Invalid value.'}`);
    this.name = 'NumericMappingError';
  }
}

const MAX_NUMERIC_FINDINGS = 3;
const MAX_CELL_PREVIEW_LENGTH = 120;

function rawCellPreview(raw: string): string {
  if (!raw.trim()) return '(empty cell)';
  return raw.length > MAX_CELL_PREVIEW_LENGTH
    ? `${raw.slice(0, MAX_CELL_PREVIEW_LENGTH - 1)}…`
    : raw;
}

export const MAX_POINTS = 12;
export const MAX_IMPORT_CHARACTERS = 200_000;

/** A deliberately bounded CSV reader. Cells stay strings until the user maps a value column. */
export function parseCSV(input: string, delimiter: Delimiter = ','): Table {
  if (input.length > MAX_IMPORT_CHARACTERS)
    throw new Error('This alpha accepts CSV files up to 200,000 characters.');
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('Paste a table with a header row and at least one data row.');
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let hasCSVStructure = false;
  let mode: 'plain' | 'quoted' | 'closed' = 'plain';
  const finishRow = () => {
    record.push(cell);
    // Skip physical blank lines, but retain rows containing explicit empty CSV cells.
    if (hasCSVStructure || record.length > 1 || record[0]?.trim()) records.push(record);
    record = [];
    cell = '';
    hasCSVStructure = false;
    mode = 'plain';
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (mode === 'quoted') {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else mode = 'closed';
      } else cell += char;
      continue;
    }
    if (char === delimiter) {
      hasCSVStructure = true;
      record.push(cell);
      cell = '';
      mode = 'plain';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      finishRow();
      continue;
    }
    if (mode === 'closed') {
      if (char === ' ' || char === '\t') continue;
      throw new Error(
        'A quoted cell must end before the next separator. Check the quotation marks.',
      );
    }
    if (char === '"') {
      if (cell !== '')
        throw new Error('Quotation marks inside a cell must be escaped as two quotation marks.');
      hasCSVStructure = true;
      mode = 'quoted';
    } else cell += char;
  }
  if (mode === 'quoted') throw new Error('A quoted cell is not closed. Check the quotation marks.');
  if (cell !== '' || record.length > 0 || mode === 'closed') finishRow();
  const headers = (records.shift() ?? []).map((value) => value.trim());
  if (headers.length < 2)
    throw new Error('Use at least two columns: a label and a numeric value. Check the separator.');
  if (headers.some((header) => !header)) throw new Error('Every column needs a non-empty header.');
  if (new Set(headers).size !== headers.length) throw new Error('Column headers must be unique.');
  if (headers.some((header) => header.length > 80))
    throw new Error('Keep column headers within 80 characters.');
  headers.forEach((header) => assertXMLText(header, 'Column header'));
  if (!records.length) throw new Error('Add at least one data row below the headers.');
  records.forEach((row, index) => {
    if (row.length !== headers.length)
      throw new Error(
        `Data row ${index + 1} has ${row.length} cells; expected ${headers.length}. Check separators or quote cells that contain them.`,
      );
  });
  return { headers, rows: records };
}

export function parseNumericCell(raw: string, format: NumberFormat): number {
  const value = raw.trim();
  if (!value)
    throw new Error('Missing values are not treated as zero. Fill the cell or remove its row.');
  const pattern =
    format === 'decimal-dot'
      ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
      : /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?$/;
  if (!pattern.test(value))
    throw new Error(
      'This cell is not a number in the selected format. Grouping separators, currency signs and percent signs are not supported; enter the numeric value only.',
    );
  const number = Number(format === 'decimal-comma' ? value.replace(',', '.') : value);
  if (number === 0 && /[1-9]/.test(value.split(/[eE]/)[0]!))
    throw new Error('This non-zero value is too small to represent safely.');
  validateValue(number);
  return Object.is(number, -0) ? 0 : number;
}

export function validateValue(value: number): void {
  if (!Number.isFinite(value)) throw new Error('Every value must be a finite number.');
  if (Math.abs(value) > 1e12 || (value !== 0 && Math.abs(value) < 1e-9)) {
    throw new Error(
      'This alpha supports zero and numeric magnitudes from 0.000000001 to 1,000,000,000,000.',
    );
  }
}

export function mapTable(
  table: Table,
  labelColumn: number,
  valueColumn: number,
  format: NumberFormat,
): DataPoint[] {
  if (
    !Number.isInteger(labelColumn) ||
    !Number.isInteger(valueColumn) ||
    labelColumn < 0 ||
    valueColumn < 0 ||
    labelColumn >= table.headers.length ||
    valueColumn >= table.headers.length
  ) {
    throw new Error('Choose a valid label column and value column.');
  }
  if (labelColumn === valueColumn)
    throw new Error('Choose different columns for labels and values.');
  if (table.rows.length < 1) throw new Error('Add at least one data row.');
  if (table.rows.length > MAX_POINTS)
    throw new Error(
      `This alpha supports up to ${MAX_POINTS} rows so that every point stays readable. Filter your table first.`,
    );
  const labels = new Set<string>();
  const validatedLabels = table.rows.map((row, index) => {
    const label = row[labelColumn]!.trim();
    if (!label) throw new Error(`Data row ${index + 1} needs a label.`);
    if (label.length > 80)
      throw new Error(`The label in data row ${index + 1} exceeds 80 characters.`);
    assertXMLText(label, `Data row ${index + 1} label`);
    if (labels.has(label))
      throw new Error(
        `The label “${label}” appears more than once. Rows are never combined automatically; use unique labels.`,
      );
    labels.add(label);
    return label;
  });
  const points: DataPoint[] = [];
  const findings: NumericImportFinding[] = [];
  let failureCount = 0;
  table.rows.forEach((row, index) => {
    const raw = row[valueColumn]!;
    try {
      points.push({ label: validatedLabels[index]!, value: parseNumericCell(raw, format) });
    } catch (error) {
      failureCount += 1;
      if (findings.length < MAX_NUMERIC_FINDINGS) {
        findings.push({
          dataRow: index + 1,
          valueColumn: table.headers[valueColumn]!,
          rawCellPreview: rawCellPreview(raw),
          reason: error instanceof Error ? error.message : 'Invalid value.',
        });
      }
    }
  });
  if (failureCount) throw new NumericMappingError(findings, failureCount);
  return points;
}
