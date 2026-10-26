const express = require('express');
const fs = require('fs');
const path = require('path');
const conf = require('../conf/config');
const requireAdGroupMember = require('./auth/requireAdGroupMember');

const dashboardConf = conf['matomoDashboard'];

// Statistiksidan från origo-matomo-plugin (dashboard/). Servern visar den byggda sidan och
// skickar sidans anrop vidare till Matomos Reporting API med en gemensam token, så att
// användarna inte behöver någon egen. Bara de metoder och parametrar som sidan använder
// skickas vidare, så tokenen kan inte användas till annat.
//
// Statistiken kräver inloggning (OpenID Connect via /origoserver/auth) av en användare i samma
// AD-grupp som report-issues. Sidan loggar in på samma sätt som report-issues-frontend och skickar
// access-token till API:t. require_login: false stänger av kontrollen, t.ex. för lokal utveckling.
const allowedMethods = new Set([
  'SitesManager.getSitesWithAtLeastViewAccess',
  'VisitsSummary.get',
  'Events.getCategory',
  'Events.getAction',
  'Events.getName'
]);
const allowedParams = ['idSite', 'period', 'date', 'segment', 'secondaryDimension', 'expanded', 'flat', 'filter_limit'];

// Segment arkiveras av Matomo när de efterfrågas och kan ta tid för långa perioder
const timeout = 120000;

// Relativa sökvägar utgår från serverns rotmapp (kod/)
const dir = path.resolve(__dirname, '..', dashboardConf.dir || 'matomo-dashboard');
// Den byggda sidan ingår inte i repot och måste kopieras hit, se CONFIG.md
const installed = fs.existsSync(path.join(dir, 'index.html'));
if (!installed) {
  console.error(`matomoDashboard: statistiksidan saknas, ${path.join(dir, 'index.html')} finns inte`);
}
const apiUrl = new URL('index.php', dashboardConf.url.endsWith('/') ? dashboardConf.url : `${dashboardConf.url}/`);
const sites = dashboardConf.sites ? new Set(dashboardConf.sites.map(String)) : null;
const requireLogin = dashboardConf.require_login !== false;
// Sidans namn i conf.auth.clients, som pekar på sidans adress
const authClient = dashboardConf.auth_client || 'matomoDashboard';

// Fel skickas i samma form som Matomos egna, så att sidan visar meddelandet
function sendError(res, status, message) {
  res.status(status).json({ result: 'error', message });
}

async function api(req, res) {
  const params = req.body || {};
  const method = params.method;
  if (!allowedMethods.has(method)) {
    return sendError(res, 403, `API-metoden ${method} är inte tillåten`);
  }
  if (sites && params.idSite !== undefined && !sites.has(String(params.idSite))) {
    return sendError(res, 403, `Karta ${params.idSite} är inte tillåten`);
  }
  if (!dashboardConf.token) {
    console.error('matomoDashboard: token saknas i konfigurationen');
    return sendError(res, 500, 'Statistikservern saknar token till Matomo.');
  }

  const body = new URLSearchParams({
    module: 'API', method, format: 'JSON', token_auth: dashboardConf.token
  });
  allowedParams.forEach((key) => {
    if (typeof params[key] === 'string') body.set(key, params[key]);
  });

  let data;
  try {
    const response = await fetch(apiUrl, { method: 'POST', body, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`Matomo svarade ${response.status} ${response.statusText}`);
    data = await response.json();
  } catch (err) {
    console.error(`matomoDashboard: ${method}: ${err.message}`);
    return sendError(res, 502, 'Kunde inte hämta statistiken från Matomo.');
  }

  if (sites && method === 'SitesManager.getSitesWithAtLeastViewAccess' && Array.isArray(data)) {
    data = data.filter((site) => sites.has(String(site.idsite)));
  }
  return res.set('Cache-Control', 'no-store').json(data);
}

// Sidan får veta att anropen går via servern och behöver då ingen adress till Matomo eller token.
// auth.url är relativ till sidan, som ligger under /origoserver/matomo/.
function config(req, res) {
  const { siteId = null, eventLocale = 'sv-SE', title = 'Kartstatistik' } = dashboardConf;
  res.set('Cache-Control', 'no-cache').json({
    siteId,
    eventLocale,
    title,
    proxy: true,
    auth: requireLogin ? { url: '../auth', client: authClient } : null
  });
}

const login = requireLogin
  ? requireAdGroupMember({ name: 'matomoDashboard', forbidden: 'Du saknar behörighet till statistiken', sendError })
  : (req, res, next) => next();

const router = express.Router();

// Sidan använder relativa sökvägar och måste därför ha ett avslutande snedstreck.
// Omdirigeringen är relativ till sidans sista del i sökvägen (/origoserver/matomo -> matomo/),
// så den kan aldrig leda till en annan webbplats. Frågan behålls för inloggningens ?code=…&state=….
const mountName = 'matomo';
router.get('/', (req, res, next) => {
  if (req.originalUrl.split('?')[0].endsWith('/')) return next();
  const query = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (typeof value === 'string') query.set(key, value);
  });
  return res.redirect(301, `${mountName}/${query.size ? `?${query}` : ''}`);
});
router.post('/api/index.php', login, api);
router.get('/config.json', config);
router.use(express.static(dir, {
  // Filerna i assets har en hash i namnet och ändras aldrig
  setHeaders(res, file) {
    res.set('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  }
}));
router.get('/', (req, res, next) => {
  if (installed) return next();
  return res.status(404).type('text').send('Statistiksidan är inte installerad på servern. Se matomoDashboard i CONFIG.md.');
});

module.exports = router;
