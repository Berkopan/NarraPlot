import type { StoryProject, SceneId } from '../story/model';

export const ARTBOARD = { width: 1200, height: 760 } as const;
export const PALETTES = {
  terracotta: {
    paper: '#fbfaf6',
    ink: '#243b4b',
    muted: '#69777c',
    grid: '#e3e4de',
    series: '#718998',
    faded: '#cad4d7',
    accent: '#cf704b',
  },
  lagoon: {
    paper: '#f5faf8',
    ink: '#233f43',
    muted: '#678080',
    grid: '#dce8e1',
    series: '#6f9991',
    faded: '#c8ded7',
    accent: '#2c8078',
  },
} as const;

export function escapeXML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );
}

export function formatValue(value: number, compact = false): string {
  if (value !== 0 && Math.abs(value) < 0.001)
    return compact
      ? value.toExponential(2).replace(/\.00e/, 'e').replace(/0e/, 'e')
      : value.toString();
  return new Intl.NumberFormat(
    'en-US',
    compact
      ? { notation: 'compact', maximumSignificantDigits: 4 }
      : { maximumSignificantDigits: 21 },
  ).format(value);
}

function estimatedWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce(
    (width, char) =>
      width +
      (/\s/.test(char)
        ? 0.27
        : /[MW@%]/.test(char)
          ? 0.88
          : /[ilI.,'!:;]/.test(char)
            ? 0.28
            : /[A-Z0-9]/.test(char)
              ? 0.64
              : /[^\u0000-\u024f]/.test(char)
                ? 0.92
                : 0.52) *
        fontSize,
    0,
  );
}

function wrap(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (estimatedWidth(next, fontSize) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
    }
    if (estimatedWidth(word, fontSize) <= maxWidth) line = word;
    else {
      for (const char of Array.from(word)) {
        if (estimatedWidth(line + char, fontSize) > maxWidth && line) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (last && estimatedWidth(`${last}…`, fontSize) > maxWidth)
    last = Array.from(last).slice(0, -1).join('');
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  attributes: string,
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${escapeXML(line)}</text>`,
    )
    .join('');
}

/** The domain is computed from all points, never from the highlighted scene. */
export function chartDomain(values: number[]): { min: number; max: number; step: number } {
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = 1;
  const roughStep = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const relative = roughStep / magnitude;
  const multiplier = [1, 2, 2.5, 5, 10].find((candidate) => candidate >= relative) ?? 10;
  const step = multiplier * magnitude;
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  return { min, max, step };
}

/** All preview and downloadable formats consume this same static scene renderer. */
export function renderSceneSVG(project: StoryProject, sceneId: SceneId): string {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId)!;
  const sceneIndex = project.scenes.indexOf(scene);
  const colors = PALETTES[project.theme];
  const { min, max, step } = chartDomain(project.points.map((point) => point.value));
  const left = 105;
  const right = 1110;
  const top = 292;
  const bottom = 577;
  const plotWidth = right - left;
  const y = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const baseline = y(0);
  const cellWidth = plotWidth / project.points.length;
  const x = (index: number) => left + cellWidth * (index + 0.5);
  const titleLines = wrap(scene.title || 'Your headline goes here', 1030, 48, 2);
  const captionY = titleLines.length > 1 ? 214 : 174;
  const title = textLines(
    titleLines,
    70,
    123,
    54,
    `fill="${colors.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="48" letter-spacing="-1.4"`,
  );
  const caption = textLines(
    wrap(scene.caption, 1010, 22, 2),
    72,
    captionY,
    30,
    `fill="${colors.muted}" font-size="22"`,
  );
  const grid: string[] = [];
  const tickCount = Math.round((max - min) / step);
  for (let index = 0; index <= tickCount; index += 1) {
    const value = min + index * step;
    const position = y(value);
    grid.push(
      `<line x1="${left}" y1="${position}" x2="${right}" y2="${position}" stroke="${colors.grid}" stroke-width="${Math.abs(value) < step / 100 ? 2 : 1}"/><text x="${left - 18}" y="${position + 5}" text-anchor="end" fill="${colors.muted}" font-size="16">${escapeXML(formatValue(Math.abs(value) < step / 100 ? 0 : value, true))}</text>`,
    );
  }
  const labels = project.points
    .map(
      (point, index) =>
        `<g><title>${escapeXML(point.label)}</title>${textLines(wrap(point.label, cellWidth - 10, 17, 2), x(index), 628, 21, `text-anchor="middle" fill="${point.label === scene.highlight ? colors.accent : colors.muted}" font-size="17" font-weight="${point.label === scene.highlight ? '700' : '400'}"`)}</g>`,
    )
    .join('');
  const marks = project.points
    .map((point, index) => {
      const selected = point.label === scene.highlight;
      const fill = selected ? colors.accent : scene.highlight ? colors.faded : colors.series;
      const pointY = y(point.value);
      const exact = `${point.label}: ${formatValue(point.value)}${project.unit ? ` ${project.unit}` : ''}`;
      const labelY = point.value >= 0 ? pointY - 13 : pointY + 24;
      const valueLabel = `<text x="${x(index)}" y="${labelY}" text-anchor="middle" font-size="${project.points.length > 8 ? 16 : 21}" font-weight="${selected ? '700' : '500'}" fill="${selected ? colors.accent : colors.ink}">${escapeXML(formatValue(point.value, true))}</text>`;
      const mark =
        project.chartType === 'bar'
          ? `<rect x="${x(index) - Math.min(92, cellWidth * 0.59) / 2}" y="${Math.min(pointY, baseline)}" width="${Math.min(92, cellWidth * 0.59)}" height="${Math.abs(baseline - pointY)}" rx="3" fill="${fill}"/>`
          : `<circle cx="${x(index)}" cy="${pointY}" r="${selected ? 9 : 6}" fill="${selected ? colors.accent : colors.series}" stroke="${colors.paper}" stroke-width="3"/>`;
      return `<g><title>${escapeXML(exact)}</title>${mark}${valueLabel}</g>`;
    })
    .join('');
  const line =
    project.chartType === 'line' && project.points.length > 1
      ? `<polyline points="${project.points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')}" fill="none" stroke="${colors.series}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
      : '';
  const source = textLines(
    wrap(
      project.source ? `Source: ${project.source}` : 'Add a source to give your story context.',
      project.showBrand ? 800 : 1050,
      15,
      2,
    ),
    72,
    706,
    20,
    `fill="${colors.muted}" font-size="15"`,
  );
  const description = `${scene.title}. ${scene.caption}. ${project.points.map((point) => `${point.label}: ${formatValue(point.value)} ${project.unit}`).join('; ')}. ${project.source}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ARTBOARD.width}" height="${ARTBOARD.height}" viewBox="0 0 ${ARTBOARD.width} ${ARTBOARD.height}" role="img" aria-labelledby="title-${sceneId} desc-${sceneId}" font-family="Arial, Helvetica, sans-serif"><title id="title-${sceneId}">${escapeXML(scene.title)}</title><desc id="desc-${sceneId}">${escapeXML(description)}</desc><rect width="1200" height="760" fill="${colors.paper}"/><rect x="72" y="48" width="21" height="4" rx="2" fill="${colors.accent}"/><text x="104" y="55" fill="${colors.muted}" font-size="13" letter-spacing="2">${['THE OVERVIEW', 'THE FOCUS', 'THE TAKEAWAY'][sceneIndex]}</text><text x="1128" y="55" fill="${colors.muted}" font-size="13" text-anchor="end">0${sceneIndex + 1} / 03</text>${title}${caption}<text x="${left}" y="265" fill="${colors.muted}" font-size="15">${escapeXML(project.unit || 'value')}</text>${grid.join('')}${line}${marks}${labels}<line x1="72" y1="679" x2="1128" y2="679" stroke="${colors.grid}"/>${source}${project.showBrand ? `<text x="1128" y="711" text-anchor="end" fill="${colors.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="22">NarraPlot</text>` : ''}</svg>`;
}
