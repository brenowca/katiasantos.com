# Kátia Santos — Estrategista Digital · Performance & Growth

Site profissional (landing page) construído com **Astro 5** e **Tailwind CSS 4**.
Identidade visual derivada da foto profissional: paleta slate `#40515F` →
`#2A3947` com branco gelo `#F4F6F7`, tipografia **Space Grotesk** (títulos e
logo) + **Inter** (corpo). Logo "Vetor K": a diagonal do K se estende e termina
num ponto de dado.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # gera o site estático em dist/
npm run preview    # serve o build para conferência
```

Requisito: Node.js 18.17+ (recomendado: 20+).

## Onde editar cada coisa

| O quê | Onde |
|---|---|
| **Contatos, links, headline, textos-chave** | `src/config/site.ts` — fonte única; alimenta todo o site |
| Números de prova, frentes, método, trajetória | também em `src/config/site.ts` |
| Cores, fontes, gradiente do hero, máscara da foto | `src/styles/global.css` (`@theme` e utilitários) |
| Página | `src/pages/index.astro` |
| Logo (símbolo + wordmark) | `src/components/LogoKS.astro` |
| SEO / Open Graph / JSON-LD | `src/layouts/Base.astro` |
| Retrato do hero | `public/katia.jpg` |
| Imagem Open Graph | `public/og.jpg` — gerada a partir de `design/og.html` (instruções de regeneração no cabeçalho do próprio arquivo) |

## Deploy no Cloudflare Pages

1. Suba o repositório para o GitHub.
2. Em [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create** → **Pages** → conecte o repositório.
3. Framework preset: **Astro** · Build command: `npm run build` ·
   Output: `dist`.
4. Em **Custom domains**, adicione `katiasantos.com` e siga o DNS.

## Pendências

- [ ] **Números reais** da seção de prova (concessionárias atendidas, estados,
      verba de mídia gerida) → `numeros` em `src/config/site.ts`
- [ ] **Confirmar telefone/WhatsApp** (o atual veio da proposta comercial)
- [ ] **Foto em alta resolução** → substituir `public/katia.jpg` (a atual é um
      recorte de screenshot) e ajustar a máscara `.retrato-mask` no
      `global.css` se necessário
- [ ] Criar a caixa `contato@katiasantos.com` no provedor de e-mail do domínio
- [ ] Decidir o destino de `public/cv-katia-santos.pdf`: o botão "Baixar CV"
      foi removido do site, mas o arquivo segue acessível pela URL direta
      (apagar, ou manter para enviar o link manualmente)
- [ ] Depoimentos: seção reservada com `TODO` no `index.astro` (2-3 quotes de
      clientes das concessionárias)
- [ ] Futuro: página do projeto/case Honda linkada a partir daqui; se quiser,
      uma página `/links` no mesmo padrão do site do Matheus

## Notas técnicas

- **Retrato fundido**: o gradiente `.bg-retrato` replica a vinheta da foto
  (tons amostrados da própria imagem), e `.retrato-mask` esmaece as bordas —
  a foto "pertence" ao fundo do site.
- **Animações**: cascata no hero (`.hero-rise`), reveal on scroll
  (`[data-reveal]` + IntersectionObserver), View Transitions do Astro.
  Tudo desativado sob `prefers-reduced-motion`.
- **Imagem OG**: `design/og.html` replica o hero em 1200×630 usando as fontes
  de `node_modules/` e a foto de `public/` — renderiza com Chrome headless e
  comprime com sharp (já presente via Astro). Comandos no cabeçalho do arquivo.
  Regenerar quando entrarem a foto em alta ou os números reais.
- Zero JavaScript de framework no cliente.
