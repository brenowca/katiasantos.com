import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  DEV_BYPASS_ACCESS?: string;
}

export interface AccessUser {
  email: string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(teamDomain: string) {
  let set = jwksCache.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, set);
  }
  return set;
}

/**
 * Valida o JWT que o Cloudflare Access injeta em cada requisição
 * (header Cf-Access-Jwt-Assertion). Sem token válido, 401.
 * Em desenvolvimento local, DEV_BYPASS_ACCESS=true em .dev.vars libera.
 */
export const requireAccess: MiddlewareHandler<{ Bindings: AccessEnv; Variables: { user: AccessUser } }> = async (c, next) => {
  if (c.env.DEV_BYPASS_ACCESS === 'true') {
    c.set('user', { email: 'dev@localhost' });
    return next();
  }
  const team = c.env.ACCESS_TEAM_DOMAIN;
  const aud = c.env.ACCESS_AUD;
  if (!team || !aud) {
    return c.json({ error: 'Cloudflare Access não configurado (ACCESS_TEAM_DOMAIN / ACCESS_AUD).' }, 500);
  }
  const token = c.req.header('Cf-Access-Jwt-Assertion') ?? getCookie(c, 'CF_Authorization');
  if (!token) return c.json({ error: 'Não autenticado.' }, 401);
  try {
    const { payload } = await jwtVerify(token, jwks(team), {
      issuer: `https://${team}`,
      audience: aud,
    });
    const email = (payload as JWTPayload & { email?: string }).email;
    if (!email) return c.json({ error: 'Token sem email.' }, 401);
    c.set('user', { email });
    return next();
  } catch {
    return c.json({ error: 'Token inválido.' }, 401);
  }
};

function getCookie(c: Context, name: string): string | undefined {
  const cookie = c.req.header('Cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}
