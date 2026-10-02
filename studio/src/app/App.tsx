import { useEffect, useState } from 'preact/hooks';
import type { Project, PublishResult } from '../shared/model';
import { me } from './api';
import { Home } from './components/Home';
import { Editor } from './components/Editor';
import { Published } from './components/Published';
import type { LoadedImage } from './slicer';

type Screen =
  | { kind: 'home' }
  | { kind: 'editor'; project: Project; image: LoadedImage }
  | { kind: 'published'; project: Project; result: PublishResult; html: { document: string; fragment: string } };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [user, setUser] = useState<{ email: string; cdnBaseUrl: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    me()
      .then(setUser)
      .catch((e: Error) => setAuthError(e.message));
  }, []);

  useEffect(() => {
    if (screen.kind !== 'editor') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [screen.kind]);

  return (
    <div class="min-h-full flex flex-col">
      <header class="border-b border-line bg-white">
        <div class="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <button class="flex items-center gap-3 text-left" onClick={() => setScreen({ kind: 'home' })} title="Início">
            <img src="/favicon.svg" alt="" class="h-7 w-7" />
            <div>
              <div class="text-sm font-semibold leading-tight">Email Studio</div>
              <div class="text-xs text-ink-3 leading-tight">Kátia Santos</div>
            </div>
          </button>
          <div class="text-xs text-ink-3">{user?.email ?? (authError ? 'sem login' : '…')}</div>
        </div>
      </header>

      <main class="flex-1">
        {authError && screen.kind === 'home' && (
          <div class="mx-auto max-w-[1400px] px-4 pt-4">
            <div class="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
              Não foi possível identificar o login: {authError}
            </div>
          </div>
        )}
        {screen.kind === 'home' && (
          <Home
            cdnBaseUrl={user?.cdnBaseUrl ?? ''}
            onStart={(project, image) => setScreen({ kind: 'editor', project, image })}
            onOpen={(project, result, html) => setScreen({ kind: 'published', project, result, html })}
          />
        )}
        {screen.kind === 'editor' && (
          <Editor
            key={screen.project.slug + screen.project.createdAt}
            initialProject={screen.project}
            image={screen.image}
            cdnBaseUrl={user?.cdnBaseUrl ?? ''}
            onCancel={() => setScreen({ kind: 'home' })}
            onPublished={(project, result, html) => setScreen({ kind: 'published', project, result, html })}
          />
        )}
        {screen.kind === 'published' && (
          <Published project={screen.project} result={screen.result} html={screen.html} onNew={() => setScreen({ kind: 'home' })} />
        )}
      </main>
    </div>
  );
}
