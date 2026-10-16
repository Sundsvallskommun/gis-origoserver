const conf = require('../../conf/config');
const { userFromRequest } = require('../auth/bearer');
const { getAssignees, cachedAssignees } = require('./reportIssuesAd');

const issuesConf = conf['reportIssues'];

// Claim i userinfo som innehåller användarnamnet i AD (sAMAccountName). Inloggningstjänsten
// skickar det i sub; username_claim i conf.reportIssues kan peka på en annan claim.
const usernameClaim = issuesConf.username_claim || 'sub';

// Skyddar /report-issues: allt utom PUT /report-issues (inrapportering från kartan) kräver
// en giltig access-token (Authorization: Bearer …) från en användare i handläggargruppen (ad_group).
// require_login: false stänger av kontrollen, t.ex. för lokal utveckling.
module.exports = async function requireCaseOfficer(req, res, next) {
  if (issuesConf.require_login === false) return next();
  if (req.method === 'OPTIONS') return next();
  if (req.method === 'PUT' && req.path === '/') return next();

  if (!conf.auth) {
    return res.status(500).json({ error: 'Inloggning är inte konfigurerad (conf.auth saknas)' });
  }

  let userinfo;
  try {
    userinfo = await userFromRequest(req);
  } catch (err) {
    console.error('report-issues: kunde inte verifiera token:', err.message || err);
    return res.status(503).json({ error: 'Kunde inte verifiera inloggningen' });
  }
  if (!userinfo) {
    return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'Inloggning krävs' });
  }

  const username = String(userinfo[usernameClaim] || '');
  let officers;
  try {
    officers = await getAssignees();
  } catch (err) {
    // Hellre en något gammal lista än att stänga ute alla om AD inte svarar
    officers = cachedAssignees();
    if (!officers) {
      console.error('report-issues: kunde inte hämta handläggargruppen från AD:', err.message || err);
      return res.status(503).json({ error: 'Kunde inte kontrollera behörighet' });
    }
  }
  if (!username || !officers.some((officer) => officer.username.toLowerCase() === username.toLowerCase())) {
    console.warn(`report-issues: nekad, användaren ${JSON.stringify(username)} (claim ${usernameClaim}) finns inte i ${issuesConf.ad_group}. Claims: ${Object.keys(userinfo).join(', ')}`);
    return res.status(403).json({ error: 'Du saknar behörighet till felrapporterna' });
  }

  req.user = { username, userinfo };
  next();
};
