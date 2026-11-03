const conf = require('../../conf/config');
const fs = require('fs');
const path = require('path');
const ActiveDirectory = require('activedirectory2');

const adConf = conf['reportIssues'];
const CACHE_MS = (adConf.ad_cache_minutes || 15) * 60 * 1000;

// userAccountControl-flagga för inaktiverat konto
const ACCOUNTDISABLE = 0x2;

// Per grupp: { at, users }. Standard är gruppen i reportIssues (ad_group); andra delar av
// servern, t.ex. dialogkarta, kan fråga efter en egen grupp med samma AD-konto.
const caches = new Map();

// AD-servern har certifikat från kommunens interna CA, som Node inte litar på som standard.
// Relativ sökväg räknas från serverns rotkatalog. Läses vid första anropet så att en saknad
// fil bara slår ut AD-uppslagen och inte hela servern.
let tlsOptions;
function getTlsOptions() {
  if (!adConf.ad_ca_file) return undefined;
  if (!tlsOptions) {
    const caPath = path.resolve(__dirname, '../..', adConf.ad_ca_file);
    tlsOptions = { ca: fs.readFileSync(caPath) };
  }
  return tlsOptions;
}

function fetchGroupMembers(group) {
  const ad = new ActiveDirectory({
    url: adConf.ad_url,
    baseDN: adConf.ad_base_dn,
    username: adConf.ad_username,
    password: adConf.ad_password,
    tlsOptions: getTlsOptions(),
    attributes: {
      user: ['sAMAccountName', 'displayName', 'givenName', 'sn', 'mail', 'userAccountControl'],
    },
  });

  return new Promise((resolve, reject) => {
    // getUsersForGroup tar även med medlemmar i nästlade grupper
    ad.getUsersForGroup(group, (err, users) => {
      if (err) return reject(err);
      if (!users) return reject(new Error(`AD-gruppen ${group} hittades inte`));
      resolve(users);
    });
  });
}

function toAssignee(user) {
  const name = user.displayName || [user.givenName, user.sn].filter(Boolean).join(' ') || user.sAMAccountName;
  return { username: user.sAMAccountName, name, email: user.mail || null };
}

// Medlemmarna i AD-gruppen, standard handläggarna i reportIssues: [{ username, name, email }],
// sorterade på namn.
async function getAssignees(group = adConf.ad_group) {
  const cache = caches.get(group);
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.users;

  const users = (await fetchGroupMembers(group))
    .filter((user) => user.sAMAccountName && !(Number(user.userAccountControl) & ACCOUNTDISABLE))
    .map(toAssignee)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  caches.set(group, { at: Date.now(), users });
  return users;
}

// Senast hämtade lista för gruppen, även om den är gammal. null om AD aldrig svarat.
function cachedAssignees(group = adConf.ad_group) {
  return caches.get(group)?.users || null;
}

module.exports = {
  getAssignees,
  cachedAssignees,
};
