# Email Studio — emails fatiados para a Kátia

Ferramenta web em `studio.katiasantos.com` para transformar a arte de um
email de marketing (uma imagem única) em um HTML de tabela com fatias
hospedadas em `cdn.mktassets.com`, com link e texto alternativo por célula.

O bucket R2 responde em dois domínios: `cdn.mktassets.com` (neutro, padrão das
novas campanhas, para o cliente da Kátia não ver o nome dela no HTML) e
`cdn.katiasantos.com` (usado pelas campanhas publicadas antes). Cada campanha
grava em `project.json` a base com que foi gerada (`cdnBaseUrl`), e "Abrir"
respeita essa base. Para trocar o padrão, mude `CDN_BASE_URL` em `wrangler.jsonc`.

- **Editor**: Vite + Preact + Tailwind 4 (`src/app/`)
- **API**: Cloudflare Worker com Hono (`src/worker/`), bucket R2 `katia-email-cdn`
- **Núcleo puro e testado**: geometria dos cortes e gerador de HTML (`src/shared/`, `tests/`)
- **Login**: Cloudflare Access (código por email), validado no Worker

## Como a Kátia usa

1. Abra `https://studio.katiasantos.com` e entre com o código enviado por email.
2. **Nova campanha**: dê um nome, confira o identificador (vira a pasta das
   imagens, não pode repetir) e envie a arte completa em PNG ou JPG.
   Exporte a arte com **1200px de largura**: o email é exibido a 600px e fica
   nítido em telas retina. Evite artes com mais de 6000px de altura.
3. No editor:
   - **Linha** (tecla H): clique na imagem para cortar uma linha horizontal.
   - **Coluna** (tecla V): clique dentro de uma linha para dividi-la em colunas
     (botões lado a lado, por exemplo).
   - Arraste a linha azul para ajustar; o **×** remove o corte. ⌘Z desfaz.
   - **Selecionar** (tecla S): clique numa fatia e preencha **Link** e
     **Texto alternativo**. Use PNG em fatias com texto ou logo; JPEG em fotos.
   - **Campanha**: cor de fundo, preheader, largura, qualidade JPEG e o
     **rodapé** de texto. Toda campanha nasce com o rodapé padrão da Honda
     ("Desacelere…" e o aviso de descadastramento via myHonda); dá para editar
     ou apagar, e "Restaurar" volta ao padrão.
   - **Pré-visualizar** mostra o email montado e os avisos (peso, altura, alt vazio).
4. **Publicar** recorta as fatias no navegador, envia tudo para o CDN e mostra:
   - **Copiar para myHonda**: imagem única (a arte inteira em `full.jpg`) com um
     mapa de links (`<map>`/`<area>`, um retângulo por célula com link), no molde
     exato de uma campanha aprovada na plataforma: div + img + map + rodapé
     obrigatório + tag `<custom name="opencounter">`. Campanhas publicadas antes
     desse formato geram a arte inteira na primeira vez que o botão é usado.
   - **Copiar para myHonda (fatiado)**: a versão anterior, em tabela de fatias,
     para comparação se a imagem única for recusada.
   - **Copiar HTML completo**: documento inteiro, para outras plataformas de disparo.
   - **Copiar como email (Gmail)**: cole direto na janela de nova mensagem.
   - **Baixar .html** e **Abrir prévia** (link público para aprovação).
   - **Baixar pacote .zip**: HTML com caminhos relativos mais a pasta `imagens/`,
     para quem quer hospedar as imagens em outro lugar.
5. A lista da tela inicial tem três abas: **Ativas**, **Aprovadas** e
   **Arquivadas**. Em cada campanha dá para marcar como aprovada (quando a
   Honda aprovar), arquivar ou restaurar. É só organização: nada é apagado e as
   imagens continuam no ar em qualquer estado.
6. Campanha publicada nunca muda. Na tela inicial, **Abrir** mostra de novo os
   botões de copiar e baixar o HTML de uma campanha já publicada. Para corrigir
   um link, use **Duplicar**: abre uma cópia com os mesmos cortes e links, e
   publica em pasta nova.

## Estrutura no R2

```
c/<slug>/
  01.jpg  02-a.png  02-b.png  ...   fatias (cache de 1 ano, imutáveis)
  index.html                        prévia pública = HTML entregue
  original                          arte completa (usada no "Duplicar")
  full.jpg (ou full.png)            arte inteira na largura de exibição (myHonda)
  project.json                      cortes, links, alts, fullImage
```

## Desenvolvimento

```bash
cd studio
npm install
cp .dev.vars.example .dev.vars   # DEV_BYPASS_ACCESS=true pula o login localmente
npm run dev                      # http://localhost:5173 (R2 simulado em .wrangler/state)
npm test                         # testes do núcleo (vitest)
npm run typecheck
```

## Configuração no Cloudflare (uma vez)

Pré-requisito: o domínio `katiasantos.com` já está na conta Cloudflare.

1. **Login do wrangler** (terminal interativo):
   ```bash
   cd studio && npx wrangler login
   ```
2. **Bucket R2**:
   ```bash
   npx wrangler r2 bucket create katia-email-cdn
   ```
3. **Domínios do CDN** (o `ZONE_ID` está na visão geral de cada domínio no painel):
   ```bash
   npx wrangler r2 bucket domain add katia-email-cdn --domain cdn.mktassets.com --zone-id <ZONE_ID_MKTASSETS>
   npx wrangler r2 bucket domain add katia-email-cdn --domain cdn.katiasantos.com --zone-id <ZONE_ID_KATIA>
   ```
   Isso cria o DNS e serve o mesmo bucket publicamente nos dois domínios.
4. **Cloudflare Access** (painel → Zero Trust → Access → Applications → Add → Self-hosted):
   - Application domain: `studio.katiasantos.com`
   - Policy "Allow": rule *Emails* com o email da Kátia e o seu
   - Identity providers: *One-time PIN*
   - Session duration: 1 semana (ou o que preferir)
   Anote o **team domain** (`<time>.cloudflareaccess.com`, em Zero Trust → Settings →
   Custom Pages) e o **Application Audience (AUD) Tag** (na página do app).
5. Preencha `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` em `wrangler.jsonc` (`vars`).
6. **Deploy** (cria o Worker e o DNS de `studio.katiasantos.com`):
   ```bash
   npm run deploy
   ```
7. Teste: abra `https://studio.katiasantos.com`, entre com o código, publique uma
   campanha de teste e confira a prévia em `https://cdn.katiasantos.com/c/<slug>/index.html`.
   Envie um teste para Gmail, Outlook e Apple Mail antes do primeiro uso real.

Sem `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`, a API responde 500 de propósito: a
ferramenta não funciona sem o login configurado.

## Decisões de HTML de email

- Tabela externa com `width="100%"` e `max-width`, mais *ghost table* de largura
  fixa para o Outlook; colunas em tabela aninhada por linha.
- Imagens com `display:block`, largura e altura explícitas, sem WebP.
- Avisos: HTML acima de 102 KB (Gmail corta), fatia acima de 1700px de altura
  (Outlook), fatia acima de 300 KB, total acima de 1,5 MB.
