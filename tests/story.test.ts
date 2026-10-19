import { describe, expect, it } from 'vitest';
import {
  createExampleProject,
  ensureReady,
  parseProjectJSON,
  replaceData,
  validateProject,
} from '../src/story/model';

describe('versioned project files', () => {
  it('round-trips all editable project state', () => {
    const project = createExampleProject();
    project.chartType = 'line';
    project.showBrand = false;
    project.scenes[1].title = '日本語の見出し';
    expect(parseProjectJSON(JSON.stringify(project))).toEqual(project);
  });
  it('reconstructs documented fields without retaining unknown content', () => {
    const input = {
      ...createExampleProject(),
      html: '<script>unexpected()</script>',
      extra: { token: 'not retained' },
    };
    expect(validateProject(input)).not.toHaveProperty('html');
    expect(validateProject(input)).not.toHaveProperty('extra');
  });
  it.each([
    [{ schemaVersion: 2 }, 'version'],
    [{ chartType: 'pie' }, 'Chart type'],
    [{ showBrand: 'false' }, 'true or false'],
    [{ points: [{ label: 'A', value: '1' }] }, 'must be a number'],
    [{ points: [{ label: 'A', value: null }] }, 'must be a number'],
    [{ points: [{ label: 'A', value: Infinity }] }, 'finite'],
    [
      {
        points: [
          { label: 'A', value: 1 },
          { label: 'A', value: 2 },
        ],
      },
      'Duplicate',
    ],
    [{ title: '' }, 'non-empty'],
    [{ source: 'Bad\u0000source' }, 'control character'],
    [{ unit: 'Bad\ufffeunit' }, 'control character'],
  ])('rejects an invalid project fragment %j', (patch, message) => {
    expect(() => validateProject({ ...createExampleProject(), ...patch })).toThrow(message);
  });
  it('rejects unknown highlights and wrong scene order', () => {
    const project = createExampleProject();
    project.scenes[1].highlight = 'not in data';
    expect(() => validateProject(project)).toThrow('not in the dataset');
    project.scenes[1].highlight = null;
    project.scenes.reverse();
    expect(() => validateProject(project)).toThrow('in that order');
  });
  it('rejects malformed, oversized and non-object JSON', () => {
    expect(() => parseProjectJSON('{ nope')).toThrow('valid JSON');
    expect(() => parseProjectJSON('null')).toThrow('object');
    expect(() => parseProjectJSON('x'.repeat(200_001))).toThrow('200,000');
  });
});

describe('data replacement', () => {
  it('preserves the design, invalidates all annotations and clears missing highlights', () => {
    const original = createExampleProject();
    original.theme = 'lagoon';
    original.chartType = 'line';
    const updated = replaceData(original, [{ label: '2025', value: 10 }], 'people', 'New source');
    expect(updated.title).toBe(original.title);
    expect(updated.theme).toBe('lagoon');
    expect(updated.chartType).toBe('line');
    expect(updated.scenes.map((scene) => scene.title)).toEqual(
      original.scenes.map((scene) => scene.title),
    );
    expect(updated.scenes.every((scene) => scene.needsReview)).toBe(true);
    expect(updated.scenes.every((scene) => scene.highlight === null)).toBe(true);
    expect(original.scenes[1].highlight).toBe('2024');
  });
  it('keeps matching highlights but requires re-review even when labels match', () => {
    const updated = replaceData(
      createExampleProject(),
      [{ label: '2024', value: 10 }],
      'people',
      'New source',
    );
    expect(updated.scenes[1].highlight).toBe('2024');
    expect(() => ensureReady(updated, 'focus')).toThrow('Review the updated data');
    updated.scenes[1].needsReview = false;
    expect(() => ensureReady(updated, 'focus')).not.toThrow();
    expect(() => ensureReady(updated)).toThrow();
  });
});
