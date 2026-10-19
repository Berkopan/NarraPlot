import { describe, expect, it } from 'vitest';
import { mapTable, parseCSV, parseNumericCell } from '../src/data/csv';

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
