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
//   adGroup    - AD-gruppen, eller en lista med grupper där det räcker att vara med i någon.
//                Standard conf.reportIssues.ad_group. Medlemmar i nästlade grupper räknas med.
//   getUserinfo - hämtar den inloggades userinfo ur anropet, eller null. Standard access-token i
//                Authorization-headern; attachment använder sessionen i stället.
module.exports = function requireAdGroupMember({
  name,
  forbidden = 'Du saknar behörighet',
  sendError = (res, status, message) => res.status(status).json({ error: message }),
  adGroup,
  getUserinfo = userFromRequest,
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
  const configured = [].concat(adGroup || []).filter(Boolean);
  const groups = configured.length ? configured : [].concat(issuesConf.ad_group || []).filter(Boolean);

  // Medlemmarna i gruppen, eller null om AD inte svarar och gruppen aldrig har hämtats.
  async function membersOf(group) {
    try {
      return await getAssignees(group);
    } catch (err) {
      // Hellre en något gammal lista än att stänga ute alla om AD inte svarar
      const members = cachedAssignees(group);
      if (!members) console.error(`${name}: kunde inte hämta gruppen ${group} från AD:`, err.message || err);
      return members;
    }
  }

  return async function requireMember(req, res, next) {
    if (!conf.auth) {
      return sendError(res, 500, 'Inloggning är inte konfigurerad (conf.auth saknas)');
    }
    if (groups.length === 0) {
      console.error(`${name}: ingen AD-grupp är inställd`);
      return sendError(res, 500, 'Inloggning är inte konfigurerad (AD-grupp saknas)');
    }

    let userinfo;
    try {
      userinfo = await getUserinfo(req);
    } catch (err) {
      console.error(`${name}: kunde inte verifiera token:`, err.message || err);
      return sendError(res, 503, 'Kunde inte verifiera inloggningen');
    }
    if (!userinfo) {
      res.set('WWW-Authenticate', 'Bearer');
      return sendError(res, 401, 'Inloggning krävs');
    }

    const username = String(userinfo[usernameClaim] || '');
    const isMember = (members) => members
      && members.some((member) => member.username.toLowerCase() === username.toLowerCase());
    // Grupperna hämtas samtidigt; var och en cachas för sig i reportIssuesAd.
    const memberLists = await Promise.all(groups.map(membersOf));

    if (!username || !memberLists.some(isMember)) {
      // Gick någon grupp inte att hämta kan användaren finnas där, så då är svaret 503, inte 403.
      if (username && memberLists.includes(null)) {
        return sendError(res, 503, 'Kunde inte kontrollera behörighet');
      }
      console.warn(`${name}: nekad, användaren ${JSON.stringify(username)} (claim ${usernameClaim}) finns inte i ${groups.join(', ')}. Claims: ${Object.keys(userinfo).join(', ')}`);
      return sendError(res, 403, forbidden);
    }

    req.user = { username, userinfo };
    return next();
  };
};
