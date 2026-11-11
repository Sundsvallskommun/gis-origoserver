// Valbar inloggning för att ändra bilagor (ladda upp och ta bort). Med require_login: true i
// conf.attachment måste användaren vara inloggad i kartan och finnas i ad_group (en grupp eller en
// lista med grupper; standard gruppen i conf.reportIssues). Läsning är alltid öppen.
//
// Origos bilageklient skickar ingen token, men redigeringskartornas OIDC-plugin loggar in via
// /origoserver/auth/access_token, som sparar användaren i sessionen. Därför läses användaren ur
// sessionskakan, och kartan måste ligga på samma adress som origoserver.
//
// Kakan skickas även med anrop från andra sajter (sameSite 'none'), så anropet måste också komma
// från kartans egen adress (Origin), annars kan en annan sida ladda upp eller ta bort bilagor i
// användarens namn.
//
//   allowed_origins - adresser som får ändra, t.ex. ['https://karta.sundsvall.se']. Standard
//                     samma adress som servern (Origin jämförs med Host/X-Forwarded-Host).

const conf = require('../../conf/config');

const host = (value) => String(value || '').split(',')[0].trim().toLowerCase();

function isAllowedOrigin(origin, req, allowedOrigins) {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, '').toLowerCase();
  if (allowedOrigins.length) return allowedOrigins.includes(normalized);
  let originHost;
  try {
    originHost = new URL(normalized).host;
  } catch {
    // Bland annat Origin: null från en sandlådad sida
    return false;
  }
  return originHost === host(req.get('x-forwarded-host') || req.get('host'));
}

// requireAdGroupMember kan bytas ut i tester.
module.exports = function createRequireWrite(attachmentConf = {}, {
  requireAdGroupMember = require('../auth/requireAdGroupMember'),
} = {}) {
  if (attachmentConf.require_login !== true) return (req, res, next) => next();

  if (!conf.session) {
    console.error('attachment: require_login kräver conf.session (sessionskakan från inloggningen)');
  }
  const allowedOrigins = [].concat(attachmentConf.allowed_origins || [])
    .map((origin) => String(origin).replace(/\/$/, '').toLowerCase());

  const requireMember = requireAdGroupMember({
    name: 'attachment',
    forbidden: 'Du saknar behörighet att ändra bilagor',
    adGroup: attachmentConf.ad_group,
    getUserinfo: async (req) => (req.session && req.session.userinfo) || null,
  });

  return function requireWrite(req, res, next) {
    if (!isAllowedOrigin(req.get('origin'), req, allowedOrigins)) {
      console.warn(`attachment: nekad, otillåten Origin ${JSON.stringify(req.get('origin') || null)}`);
      return res.status(403).json({ error: 'Anropet kommer från en otillåten adress' });
    }
    return requireMember(req, res, next);
  };
};

module.exports.isAllowedOrigin = isAllowedOrigin;
