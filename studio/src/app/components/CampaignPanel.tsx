import type { Project } from '../../shared/model';
import { isValidSlug } from '../../shared/slug';

interface Props {
  project: Project;
  onChange: (p: Project) => void;
}

export function CampaignPanel({ project, onChange }: Props) {
  const set = <K extends keyof Project>(k: K, v: Project[K]) => onChange({ ...project, [k]: v });
  const slugOk = isValidSlug(project.slug);
  return (
    <div class="card space-y-3">
      <div class="text-sm font-semibold">Campanha</div>
      <div>
        <label class="label" for="cname">Nome</label>
        <input id="cname" class="input" value={project.name} onInput={(e) => set('name', (e.target as HTMLInputElement).value)} />
      </div>
      <div>
        <label class="label" for="cslug">Identificador</label>
        <input id="cslug" class={`input font-mono ${slugOk ? '' : 'border-danger'}`} value={project.slug} onInput={(e) => set('slug', (e.target as HTMLInputElement).value)} />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="dw">Largura no email</label>
          <input
            id="dw"
            type="number"
            min={300}
            max={800}
            class="input"
            value={project.displayWidth}
            onInput={(e) => set('displayWidth', Math.max(300, Math.min(800, Number((e.target as HTMLInputElement).value) || 600)))}
          />
        </div>
        <div>
          <label class="label" for="bg">Cor de fundo</label>
          <div class="flex items-center gap-2">
            <input id="bg" type="color" class="h-9 w-12 rounded border border-line" value={project.backgroundColor} onInput={(e) => set('backgroundColor', (e.target as HTMLInputElement).value)} />
            <input class="input font-mono" value={project.backgroundColor} onInput={(e) => set('backgroundColor', (e.target as HTMLInputElement).value)} />
          </div>
        </div>
      </div>
      <div>
        <label class="label" for="pre">Preheader (texto da prévia na caixa de entrada)</label>
        <input id="pre" class="input" value={project.preheader} onInput={(e) => set('preheader', (e.target as HTMLInputElement).value)} placeholder="Opcional" />
      </div>
      <div>
        <label class="label" for="q">Qualidade JPEG: {Math.round(project.jpegQuality * 100)}%</label>
        <input id="q" type="range" min={50} max={95} step={5} class="w-full" value={Math.round(project.jpegQuality * 100)} onInput={(e) => set('jpegQuality', Number((e.target as HTMLInputElement).value) / 100)} />
      </div>
    </div>
  );
}
