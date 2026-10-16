const conf = require('../../conf/config');
const fs = require('fs');
const path = require('path');
const ActiveDirectory = require('activedirectory2');

const adConf = conf['reportIssues'];
const CACHE_MS = (adConf.ad_cache_minutes || 15) * 60 * 1000;

// userAccountControl-flagga för inaktiverat konto
const ACCOUNTDISABLE = 0x2;

let cache = { at: 0, users: null };

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

function fetchGroupMembers() {
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
    ad.getUsersForGroup(adConf.ad_group, (err, users) => {
      if (err) return reject(err);
      if (!users) return reject(new Error(`AD-gruppen ${adConf.ad_group} hittades inte`));
      resolve(users);
    });
  });
}

function toAssignee(user) {
  const name = user.displayName || [user.givenName, user.sn].filter(Boolean).join(' ') || user.sAMAccountName;
  return { username: user.sAMAccountName, name, email: user.mail || null };
}

// Handläggarna i AD-gruppen: [{ username, name, email }], sorterade på namn.
async function getAssignees() {
  if (cache.users && Date.now() - cache.at < CACHE_MS) return cache.users;

  const users = (await fetchGroupMembers())
    .filter((user) => user.sAMAccountName && !(Number(user.userAccountControl) & ACCOUNTDISABLE))
    .map(toAssignee)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  cache = { at: Date.now(), users };
  return users;
}

// Senast hämtade lista, även om den är gammal. null om AD aldrig svarat.
function cachedAssignees() {
  return cache.users;
}

module.exports = {
  getAssignees,
  cachedAssignees,
};
