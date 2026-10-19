import { MAX_POINTS, validateValue } from '../data/csv';
import type { DataPoint } from '../data/csv';
import { assertXMLText } from '../data/text';

export const SCENE_IDS = ['overview', 'focus', 'takeaway'] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export type ChartType = 'bar' | 'line';
export type Theme = 'terracotta' | 'lagoon';
export interface Scene {
  id: SceneId;
  title: string;
  caption: string;
  highlight: string | null;
  needsReview: boolean;
}
export interface StoryProject {
  schemaVersion: 1;
  title: string;
  chartType: ChartType;
  theme: Theme;
  unit: string;
  source: string;
  points: DataPoint[];
  scenes: [Scene, Scene, Scene];
  showBrand: boolean;
}

export const SAMPLE_CSV =
  'Year,Bicycle trips\n2019,128\n2020,116\n2021,164\n2022,201\n2023,251\n2024,312';

export function createExampleProject(): StoryProject {
  return {
    schemaVersion: 1,
    title: 'A city finding its stride',
    chartType: 'bar',
    theme: 'terracotta',
    unit: 'thousand trips',
    source: 'Synthetic example · not observed city statistics',
    points: [128, 116, 164, 201, 251, 312].map((value, index) => ({
      label: String(2019 + index),
      value,
    })),
    scenes: [
      {
        id: 'overview',
        title: 'More trips. A different city.',
        caption: 'Six years of bicycle trips, in one picture. Start with the whole story.',
        highlight: null,
        needsReview: false,
      },
      {
        id: 'focus',
        title: 'One year brings it into focus.',
        caption: 'In this illustrative dataset, 2024 has the most bicycle trips: 312 thousand.',
        highlight: '2024',
        needsReview: false,
      },
      {
        id: 'takeaway',
        title: 'Give the numbers a point.',
        caption: 'What should your reader take away? Make the last scene your own.',
        highlight: '2024',
        needsReview: false,
      },
    ],
    showBrand: true,
  };
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, name: string, max: number, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error(
      `${name} must be ${allowEmpty ? 'text' : 'non-empty text'} of at most ${max} characters.`,
    );
  assertXMLText(value, name);
  return value;
}
function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`);
  return value;
}

/** Reconstruct only documented fields; project files never supply HTML, code or URLs. */
export function validateProject(input: unknown): StoryProject {
  const root = object(input, 'Project');
  if (root.schemaVersion !== 1)
    throw new Error('This project version is not supported. Expected schemaVersion 1.');
  if (root.chartType !== 'bar' && root.chartType !== 'line')
    throw new Error('Chart type must be bar or line.');
  if (root.theme !== 'terracotta' && root.theme !== 'lagoon')
    throw new Error('Choose a supported theme.');
  if (!Array.isArray(root.points) || root.points.length < 1 || root.points.length > MAX_POINTS)
    throw new Error(`A project needs 1–${MAX_POINTS} data points.`);
  const labels = new Set<string>();
  const points: DataPoint[] = root.points.map((raw, index) => {
    const point = object(raw, `Point ${index + 1}`);
    const label = string(point.label, `Point ${index + 1} label`, 80, false);
    if (label !== label.trim())
      throw new Error('Point labels cannot have leading or trailing whitespace.');
    if (labels.has(label)) throw new Error(`Duplicate point label: ${label}.`);
    labels.add(label);
    if (typeof point.value !== 'number')
      throw new Error(`Point ${index + 1} value must be a number.`);
    validateValue(point.value);
    return { label, value: Object.is(point.value, -0) ? 0 : point.value };
  });
  if (!Array.isArray(root.scenes) || root.scenes.length !== 3)
    throw new Error('A project needs exactly three scenes.');
  const scenes = root.scenes.map((raw, index) => {
    const scene = object(raw, `Scene ${index + 1}`);
    if (scene.id !== SCENE_IDS[index])
      throw new Error('Scenes must be overview, focus and takeaway, in that order.');
    if (
      scene.highlight !== null &&
      (typeof scene.highlight !== 'string' || !labels.has(scene.highlight))
    )
      throw new Error(`Scene ${index + 1} highlights a point that is not in the dataset.`);
    return {
      id: scene.id,
      title: string(scene.title, `Scene ${index + 1} title`, 110),
      caption: string(scene.caption, `Scene ${index + 1} caption`, 220),
      highlight: scene.highlight,
      needsReview: boolean(scene.needsReview, 'Review status'),
    } as Scene;
  }) as [Scene, Scene, Scene];
  return {
    schemaVersion: 1,
    title: string(root.title, 'Project title', 80, false),
    chartType: root.chartType,
    theme: root.theme,
    unit: string(root.unit, 'Unit', 40),
    source: string(root.source, 'Source', 160),
    points,
    scenes,
    showBrand: boolean(root.showBrand, 'Brand attribution'),
  };
}

export function parseProjectJSON(text: string): StoryProject {
  if (text.length > 200_000)
    throw new Error('Project files must be smaller than 200,000 characters.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Open a NarraPlot .narraplot.json project.');
  }
  return validateProject(value);
}

export function replaceData(
  project: StoryProject,
  points: DataPoint[],
  unit: string,
  source: string,
): StoryProject {
  const labels = new Set(points.map((point) => point.label));
  return validateProject({
    ...project,
    points,
    unit,
    source,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      highlight: scene.highlight && labels.has(scene.highlight) ? scene.highlight : null,
      needsReview: true,
    })),
  });
}

export function ensureReady(project: StoryProject, sceneId?: SceneId): void {
  const pending = project.scenes.filter(
    (scene) => (!sceneId || scene.id === sceneId) && scene.needsReview,
  );
  if (pending.length)
    throw new Error('Review the updated data and confirm each affected scene before exporting.');
}
