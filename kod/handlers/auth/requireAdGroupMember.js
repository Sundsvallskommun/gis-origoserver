const conf = require('../../conf/config');
const { userFromRequest } = require('./bearer');

// Middleware som kräver en giltig access-token (Authorization: Bearer …) från en användare i
// en AD-grupp, standard gruppen i conf.reportIssues (ad_group). Används av report-issues,
// statistiksidan för Matomo och dialogkarta. AD-kontot för uppslagen ställs alltid in i
// conf.reportIssues.
// Sätter req.user = { username, userinfo }.
//
//   name       - namn i loggarna, t.ex. 'report-issues'
//   forbidden  - felmeddelandet när användaren inte finns i gruppen
//   sendError  - skickar ett fel, standard { error: meddelande }
//   adGroup    - AD-gruppen, standard conf.reportIssues.ad_group
module.exports = function requireAdGroupMember({
  name,
  forbidden = 'Du saknar behörighet',
  sendError = (res, status, message) => res.status(status).json({ error: message }),
  adGroup,
}) {
  const issuesConf = conf['reportIssues'];

  // AD-uppgifterna och gruppen ställs in i conf.reportIssues. Saknas de svarar API:t med fel
  // i stället för att servern inte startar.
  if (!issuesConf) {
    console.error(`${name}: inloggning kräver conf.reportIssues (AD-gruppen)`);
    return (req, res) => sendError(res, 500, 'Inloggning är inte konfigurerad (conf.reportIssues saknas)');
  }

  // Laddas först här, eftersom modulen läser conf.reportIssues när den laddas
  const { getAssignees, cachedAssignees } = require('../openapi/reportIssuesAd');

  // Claim i userinfo som innehåller användarnamnet i AD (sAMAccountName). Inloggningstjänsten
  // skickar det i sub; username_claim i conf.reportIssues kan peka på en annan claim.
  const usernameClaim = issuesConf.username_claim || 'sub';
  const group = adGroup || issuesConf.ad_group;

  return async function requireMember(req, res, next) {
    if (!conf.auth) {
      return sendError(res, 500, 'Inloggning är inte konfigurerad (conf.auth saknas)');
    }

    let userinfo;
    try {
      userinfo = await userFromRequest(req);
    } catch (err) {
      console.error(`${name}: kunde inte verifiera token:`, err.message || err);
      return sendError(res, 503, 'Kunde inte verifiera inloggningen');
    }
    if (!userinfo) {
      res.set('WWW-Authenticate', 'Bearer');
      return sendError(res, 401, 'Inloggning krävs');
    }

    const username = String(userinfo[usernameClaim] || '');
    let members;
    try {
      members = await getAssignees(group);
    } catch (err) {
      // Hellre en något gammal lista än att stänga ute alla om AD inte svarar
      members = cachedAssignees(group);
      if (!members) {
        console.error(`${name}: kunde inte hämta gruppen från AD:`, err.message || err);
        return sendError(res, 503, 'Kunde inte kontrollera behörighet');
      }
    }
    if (!username || !members.some((member) => member.username.toLowerCase() === username.toLowerCase())) {
      console.warn(`${name}: nekad, användaren ${JSON.stringify(username)} (claim ${usernameClaim}) finns inte i ${group}. Claims: ${Object.keys(userinfo).join(', ')}`);
      return sendError(res, 403, forbidden);
    }

    req.user = { username, userinfo };
    return next();
  };
};
