// ─────────────────────────────────────────────────────────────
// FONTE ÚNICA DA VERDADE
// Contatos, links e conteúdo estruturado do site.
// ─────────────────────────────────────────────────────────────

export const site = {
  nome: 'Kátia Santos',
  titulo: 'Estrategista Digital · Performance & Growth',
  headline: 'Marketing que vira processo, não dependência.',
  subheadline:
    'Mais de 7 anos construindo estratégia digital, performance e operações ' +
    'de marketing para o varejo automotivo.',

  cidade: 'Teresópolis',
  uf: 'RJ',

  // TODO: confirmar com a Kátia (número usado na proposta comercial)
  telefoneDisplay: '(21) 99925-6759',
  telefone: '+55 21 99925-6759',

  email: 'contato@katiasantos.com',
  linkedin: 'https://linkedin.com/in/katia-santos-mkt',
  url: 'https://katiasantos.com',
  cvPath: '/cv-katia-santos.pdf',

  descricao:
    'Estrategista digital com mais de 7 anos de atuação em performance e growth ' +
    'para o varejo automotivo, liderando estratégias para a rede de concessionárias ' +
    'Honda Motos Brasil. Consultoria de estruturação de marketing interno e geração de leads.',

  mensagemWhatsApp: 'Olá, Kátia! Vi seu site e gostaria de conversar.',
} as const;

// ── Derivados (não editar) ───────────────────────────────────
export const telefoneLimpo = site.telefone.replace(/[^\d+]/g, '');
export const linkTelefone = `tel:${telefoneLimpo}`;
export const linkEmail = `mailto:${site.email}`;
export const linkWhatsApp = `https://wa.me/${telefoneLimpo.replace('+', '')}?text=${encodeURIComponent(site.mensagemWhatsApp)}`;

// ── Prova em números ─────────────────────────────────────────
// TODO: quando a Kátia passar os números reais, trocar/adicionar
// métricas concretas, ex.:
//   { valor: 'XX', label: 'concessionárias atendidas em X estados' },
//   { valor: 'R$ X mi', label: 'em mídia gerida por ano' },
export const numeros = [
  { valor: '7+', label: 'anos de estratégia digital e performance' },
  { valor: '5+', label: 'anos à frente do Núcleo Honda em agência credenciada' },
  { valor: 'Honda', label: 'Motos Brasil — rede de concessionárias atendida' },
] as const;

// ── Frentes de atuação ───────────────────────────────────────
export const frentes = [
  {
    titulo: 'Estratégia digital & growth',
    descricao:
      'Planejamento orientado a dados, conectando comportamento do consumidor e objetivos comerciais.',
  },
  {
    titulo: 'Performance & tráfego pago',
    descricao:
      'Gestão de Google Ads e Meta Ads com mensuração e otimização contínua de campanhas.',
  },
  {
    titulo: 'Marketing interno & processos',
    descricao:
      'Implantação de fluxos de leads, rotinas e playbooks para times ganharem autonomia.',
  },
  {
    titulo: 'Dados & KPIs',
    descricao:
      'Funis, indicadores e rituais de análise para decisões previsíveis e escaláveis.',
  },
] as const;

// ── Método de trabalho (consultoria) ─────────────────────────
export const metodo = [
  { titulo: 'Diagnóstico', descricao: 'Auditoria de processos, canais e gargalos da operação atual.' },
  { titulo: 'Estruturação', descricao: 'Setup de canais, fluxos de leads e tráfego integrado.' },
  { titulo: 'Treinamento', descricao: 'Capacitação prática do time de marketing interno.' },
  { titulo: 'Acompanhamento', descricao: 'Análise contínua do desempenho do fluxo e das campanhas.' },
  { titulo: 'Otimização', descricao: 'Ajustes finos para consolidar autonomia e previsibilidade.' },
] as const;

export const citacaoMetodo =
  'O objetivo não é terceirizar o seu marketing — é implantar e consolidar processos que ficam.';

// ── Trajetória ───────────────────────────────────────────────
export const trajetoria = [
  {
    periodo: 'Formação',
    titulo: 'Graduação em Gestão de Marketing',
    descricao: 'Base em estratégia, dados e comportamento do consumidor.',
  },
  {
    periodo: '2019 – 2024',
    titulo: 'Coordenadora Estratégica — Núcleo Honda · UM Agência',
    descricao:
      'Coordenação estratégica do núcleo, atendendo concessionárias Honda em diversos estados: tráfego pago em Google e Meta Ads, definição de KPIs e boas práticas replicáveis para toda a rede.',
  },
  {
    periodo: '2025 – 2026',
    titulo: 'Diretora de Marketing — UM Agência (credenciada Assoparts)',
    descricao:
      'Liderança da estratégia de marketing da agência, com foco em performance e crescimento sustentável da rede de concessionárias Honda Motos Brasil.',
  },
  {
    periodo: 'Em curso',
    titulo: 'Pós-graduação em Gestão Ágil',
    descricao:
      'Visão estratégica e otimização de processos — alta performance nasce de estratégia clara e execução eficiente.',
  },
] as const;
