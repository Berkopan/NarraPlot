import { describe, expect, it } from 'vitest';
import { mapTable, NumericMappingError, parseCSV, parseNumericCell } from '../src/data/csv';

describe('CSV import', () => {
  it('preserves identifiers and handles BOM, CRLF and quoted delimiters', () => {
    const table = parseCSV('\uFEFFCode,Amount\r\n00123,4\r\n"North, west",5\r\n');
    expect(mapTable(table, 0, 1, 'decimal-dot')).toEqual([
      { label: '00123', value: 4 },
      { label: 'North, west', value: 5 },
    ]);
  });
  it('handles escaped quotes and newlines inside quoted cells', () => {
    expect(parseCSV('Label,Value\n"A ""quoted""\nlabel",2').rows[0]).toEqual([
      'A "quoted"\nlabel',
      '2',
    ]);
  });
  it('supports an explicit decimal-comma format and semicolon separator', () => {
    expect(mapTable(parseCSV('Place;Value\nA;1234,56', ';'), 0, 1, 'decimal-comma')).toEqual([
      { label: 'A', value: 1234.56 },
    ]);
  });
  it('accepts pasted TSV when tab is selected', () => {
    expect(mapTable(parseCSV('Code\tValue\n001\t-2.5', '\t'), 0, 1, 'decimal-dot')[0]).toEqual({
      label: '001',
      value: -2.5,
    });
  });
  it('skips only physical blank lines', () => {
    expect(parseCSV('Label,Value\n\nA,1\n\n').rows).toEqual([['A', '1']]);
    expect(() => parseCSV('Label,Value\nA,1\n""\nB,2')).toThrow('has 1 cells');
    expect(() => mapTable(parseCSV('Label,Value\nA,1\n,'), 0, 1, 'decimal-dot')).toThrow(
      'needs a label',
    );
  });
  it.each([
    ['Label,Label\nA,1', 'unique'],
    [',Value\nA,1', 'non-empty header'],
    ['Label,Value\nA,1,2', 'has 3 cells'],
    ['Label,Value\n"A,1', 'not closed'],
    ['Label,Value\n"A"oops,1', 'quoted cell must end'],
  ])('rejects malformed input: %s', (csv, message) => expect(() => parseCSV(csv)).toThrow(message));
  it('does not aggregate duplicate labels', () => {
    expect(() => mapTable(parseCSV('Label,Value\nA,1\nA,2'), 0, 1, 'decimal-dot')).toThrow(
      'never combined',
    );
  });
  it('requires distinct, valid mappings', () => {
    const table = parseCSV('Label,Value\nA,1');
    expect(() => mapTable(table, 1, 1, 'decimal-dot')).toThrow('different columns');
    expect(() => mapTable(table, 0, 5, 'decimal-dot')).toThrow('valid label column');
  });
  it('bounds input size and chart density explicitly', () => {
    expect(() => parseCSV('x'.repeat(200_001))).toThrow('200,000');
    const csv = `Label,Value\n${Array.from({ length: 13 }, (_, index) => `A${index},${index}`).join('\n')}`;
    expect(() => mapTable(parseCSV(csv), 0, 1, 'decimal-dot')).toThrow('up to 12');
  });
  it('rejects export-breaking characters in a label', () => {
    expect(() => mapTable(parseCSV('Label,Value\nA\u0000B,1'), 0, 1, 'decimal-dot')).toThrow(
      'control character',
    );
  });
});

describe('explicit numeric parsing', () => {
  it.each(['', ' ', 'NaN', 'Infinity', '0x10', '10%', '$20', '1,234', '12.3.4'])(
    'rejects %j instead of guessing',
    (value) => {
      expect(() => parseNumericCell(value, 'decimal-dot')).toThrow();
    },
  );
  it('rejects a wrong locale and values outside the supported range', () => {
    expect(() => parseNumericCell('1.23', 'decimal-comma')).toThrow('selected format');
    expect(() => parseNumericCell('1e400', 'decimal-dot')).toThrow('finite');
    expect(() => parseNumericCell('1e-10', 'decimal-dot')).toThrow('magnitudes');
    expect(() => parseNumericCell('1000000000001', 'decimal-dot')).toThrow('magnitudes');
  });
  it.each(['1e-999', '-2e-999', '0.0001e-999'])(
    'never underflows non-zero %s into zero',
    (value) => {
      expect(() => parseNumericCell(value, 'decimal-dot')).toThrow('too small');
    },
  );
  it('also rejects underflow with decimal commas while accepting actual zero', () => {
    expect(() => parseNumericCell('0,01e-999', 'decimal-comma')).toThrow('too small');
    expect(parseNumericCell('0e-999', 'decimal-dot')).toBe(0);
    expect(Object.is(parseNumericCell('-0', 'decimal-dot'), -0)).toBe(false);
    expect(parseNumericCell('1e-9', 'decimal-dot')).toBe(1e-9);
  });
});

describe('bounded numeric diagnostics', () => {
  function diagnosticError(csv: string, labelColumn: number, valueColumn: number) {
    try {
      mapTable(parseCSV(csv, ';'), labelColumn, valueColumn, 'decimal-comma');
    } catch (error) {
      expect(error).toBeInstanceOf(NumericMappingError);
      return error as NumericMappingError;
    }
    throw new Error('Expected a complete-import validation error.');
  }

  it('reports all three selected-column failures without losing leading-zero labels', () => {
    const csv =
      'Note;Code;Amount\nalpha;001;12,5\nbeta;002;8%\ngamma;003;\ndelta;004;<img src=x onerror=alert(1)>\nepsilon;005;-2,25';
    const error = diagnosticError(csv, 1, 2);
    expect(error.failureCount).toBe(3);
    expect(error.findings.map((finding) => finding.dataRow)).toEqual([2, 3, 4]);
    expect(error.findings.map((finding) => finding.valueColumn)).toEqual([
      'Amount',
      'Amount',
      'Amount',
    ]);
    expect(error.findings.map((finding) => finding.rawCellPreview)).toEqual([
      '8%',
      '(empty cell)',
      '<img src=x onerror=alert(1)>',
    ]);
    expect(error.findings[1]?.reason).toContain('Missing values');
    expect(error.findings[0]?.reason).toContain('selected format');
    const corrected = csv
      .replace('002;8%', '002;8')
      .replace('003;\n', '003;0\n')
      .replace('004;<img src=x onerror=alert(1)>', '004;9');
    expect(mapTable(parseCSV(corrected, ';'), 1, 2, 'decimal-comma')).toEqual([
      { label: '001', value: 12.5 },
      { label: '002', value: 8 },
      { label: '003', value: 0 },
      { label: '004', value: 9 },
      { label: '005', value: -2.25 },
    ]);
  });

  it('shows only three findings, counts additional failures, and truncates unsafe previews', () => {
    const longCell = '<b>' + 'x'.repeat(300);
    const csv = `Code;Amount\nA;${longCell}\nB;\nC;8%\nD;not-number\nE;5`;
    const error = diagnosticError(csv, 0, 1);
    expect(error.failureCount).toBe(4);
    expect(error.findings).toHaveLength(3);
    expect(error.findings.map((finding) => finding.dataRow)).toEqual([1, 2, 3]);
    expect(error.findings[0]?.rawCellPreview).toHaveLength(120);
    expect(error.findings[0]?.rawCellPreview.endsWith('…')).toBe(true);
    expect(error.findings[0]?.reason).not.toContain(longCell);
    expect(error.findings[0]?.reason.length).toBeLessThan(200);
    expect(error.findings[1]?.rawCellPreview).toBe('(empty cell)');
  });

  it('still rejects duplicate labels before any partial numeric mapping', () => {
    expect(() => mapTable(parseCSV('Code;Amount\nA;8%\nA;no', ';'), 0, 1, 'decimal-comma')).toThrow(
      'never combined',
    );
  });
});
