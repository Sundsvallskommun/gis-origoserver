const conf = require('../../conf/config');
const requireAdGroupMember = require('../auth/requireAdGroupMember');

const issuesConf = conf['reportIssues'];

const requireCaseOfficer = requireAdGroupMember({
  name: 'report-issues',
  forbidden: 'Du saknar behörighet till felrapporterna',
});

// Skyddar /report-issues: allt utom PUT /report-issues (inrapportering från kartan) kräver
// en giltig access-token (Authorization: Bearer …) från en användare i handläggargruppen (ad_group).
// require_login: false stänger av kontrollen, t.ex. för lokal utveckling.
module.exports = function reportIssuesAuth(req, res, next) {
  if (issuesConf.require_login === false) return next();
  if (req.method === 'OPTIONS') return next();
  if (req.method === 'PUT' && req.path === '/') return next();
  return requireCaseOfficer(req, res, next);
};
