import { ARTBOARD, escapeXML, renderSceneSVG } from './svg';
import { ensureReady } from '../story/model';
import type { SceneId, StoryProject } from '../story/model';

export function safeFilename(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 65) || 'narraplot-story'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function exportSVG(project: StoryProject, sceneId: SceneId): void {
  ensureReady(project, sceneId);
  downloadBlob(
    new Blob([renderSceneSVG(project, sceneId)], { type: 'image/svg+xml;charset=utf-8' }),
    `${safeFilename(project.title)}-${sceneId}.svg`,
  );
}

export async function exportPNG(project: StoryProject, sceneId: SceneId): Promise<void> {
  ensureReady(project, sceneId);
  const blob = new Blob([renderSceneSVG(project, sceneId)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = ARTBOARD.width * 2;
    canvas.height = ARTBOARD.height * 2;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Your browser could not create an image canvas. Try SVG instead.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('PNG export failed. Try SVG instead.')),
        'image/png',
      ),
    );
    downloadBlob(png, `${safeFilename(project.title)}-${sceneId}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createStoryHTML(project: StoryProject): string {
  ensureReady(project);
  const scenes = project.scenes
    .map(
      (scene, index) =>
        `<section class="scene" ${index ? 'hidden' : ''} aria-label="Scene ${index + 1}">${renderSceneSVG(project, scene.id)}</section>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeXML(project.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f1eb;color:#243b4b;font:15px Arial,Helvetica,sans-serif}main{max-width:1200px;margin:4vh auto;padding:16px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:16px}h1{font-size:18px;margin:0}svg{display:block;width:100%;height:auto}.scene{box-shadow:0 4px 24px #243b4b10;border:1px solid #dce1da;border-radius:12px;overflow:hidden}.scene[hidden]{display:none}nav{display:flex;gap:12px;align-items:center;justify-content:center;margin-top:22px}button{border:1px solid #cbd5d1;background:white;color:#243b4b;padding:10px 18px;border-radius:8px;font:inherit;cursor:pointer}button:disabled{opacity:.35;cursor:default}button:focus-visible{outline:3px solid #cf704b;outline-offset:3px}.hint{text-align:center;font-size:12px;color:#69777c}@media(prefers-reduced-motion:no-preference){.scene{animation:appear .2s ease}@keyframes appear{from{opacity:.2}to{opacity:1}}}</style></head><body><main><header><h1>${escapeXML(project.title)}</h1><span>3 scenes</span></header>${scenes}<nav aria-label="Story navigation"><button id="previous" disabled>← Previous</button><span id="position" aria-live="polite">1 / 3</span><button id="next">Next →</button></nav><p class="hint">Use the arrow keys to move through the story.</p></main><script>(()=>{let index=0;const scenes=Array.from(document.querySelectorAll('.scene'));const previous=document.getElementById('previous');const next=document.getElementById('next');const position=document.getElementById('position');function show(value){index=Math.max(0,Math.min(scenes.length-1,value));scenes.forEach((scene,i)=>{scene.hidden=i!==index});previous.disabled=index===0;next.disabled=index===scenes.length-1;position.textContent=(index+1)+' / '+scenes.length}previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));document.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')show(index-1);if(event.key==='ArrowRight')show(index+1)})})();</script></body></html>`;
}

export function exportHTML(project: StoryProject): void {
  downloadBlob(
    new Blob([createStoryHTML(project)], { type: 'text/html;charset=utf-8' }),
    `${safeFilename(project.title)}.html`,
  );
}
