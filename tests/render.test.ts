import { describe, expect, it } from 'vitest';
import { createExampleProject, replaceData } from '../src/story/model';
import { chartDomain, formatValue, renderSceneSVG } from '../src/render/svg';
import { createStoryHTML, safeFilename } from '../src/render/export';

describe('shared scene rendering', () => {
  it('uses the same finite, zero-inclusive scale across scenes and handles zero-only input', () => {
    expect(chartDomain([-2, 4])).toEqual({ min: -2, max: 4, step: 2 });
    const zero = chartDomain([0, 0]);
    expect(zero.min).toBe(0);
    expect(zero.max).toBeGreaterThan(0);
    const project = createExampleProject();
    const overview = renderSceneSVG(project, 'overview');
    const focus = renderSceneSVG(project, 'focus');
    const grid = (svg: string) => svg.match(/<line x1="105"[^>]+/g);
    expect(grid(overview)).toEqual(grid(focus));
    expect(overview).not.toMatch(/NaN|Infinity/);
  });
  it('draws zero bars with zero height and gives negative values room before category labels', () => {
    const project = replaceData(
      createExampleProject(),
      [
        { label: 'Negative', value: -2 },
        { label: 'Zero', value: 0 },
        { label: 'Positive', value: 4 },
      ],
      '',
      'Test',
    );
    const svg = renderSceneSVG(project, 'overview');
    expect(svg).toMatch(/height="0" rx="3"/);
    expect(svg).toContain('y="601" text-anchor="middle"');
    expect(svg).toContain('y="628" text-anchor="middle"');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it('keeps exact small values available rather than rounding source descriptions', () => {
    expect(formatValue(0.000123456789)).toBe('0.000123456789');
    expect(formatValue(0.30000000000000004)).toBe('0.30000000000000004');
    expect(formatValue(0.000123456789, true)).toBe('1.23e-4');
  });
  it('escapes data and annotations in SVG and standalone HTML', () => {
    const project = createExampleProject();
    project.title = '</title><img src=x onerror=alert(1)>';
    project.scenes[0].title = '<script>alert("x")</script>';
    project.scenes[0].caption = 'A & B < C';
    project.points[0]!.label = '<image onload="alert(1)">';
    const svg = renderSceneSVG(project, 'overview');
    const html = createStoryHTML(project);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<image onload');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('A &amp; B &lt; C');
    expect(html).not.toContain('<img src=x');
    expect(html.match(/<script>/g)).toHaveLength(1);
  });
  it('exports a portable three-scene document with optional brand credit', () => {
    const project = createExampleProject();
    project.showBrand = false;
    const html = createStoryHTML(project);
    expect(html.match(/<section class="scene"/g)).toHaveLength(3);
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<link');
    expect(renderSceneSVG(project, 'overview')).not.toContain('>NarraPlot</text>');
  });
  it('prevents whole-story export while any annotation is stale', () => {
    const project = createExampleProject();
    project.scenes[2].needsReview = true;
    expect(() => createStoryHTML(project)).toThrow('Review');
  });
  it('creates a bounded filename without path or executable markup', () => {
    expect(safeFilename('../../Hello <script> world')).toBe('hello-script-world');
    expect(safeFilename('日本語')).toBe('narraplot-story');
    expect(safeFilename('a'.repeat(100))).toHaveLength(65);
  });
});
