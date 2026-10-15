const conf = require('../../../../conf/config');
const fs = require('fs');
const ActiveDirectory = require('activedirectory2');

const adConf = conf['reportIssues'];
const CACHE_MS = (adConf.ad_cache_minutes || 15) * 60 * 1000;

// userAccountControl-flagga för inaktiverat konto
const ACCOUNTDISABLE = 0x2;

let cache = { at: 0, users: null };

// AD-servern har certifikat från kommunens interna CA, som Node inte litar på som standard
const tlsOptions = adConf.ad_ca_file ? { ca: fs.readFileSync(adConf.ad_ca_file) } : undefined;

function fetchGroupMembers() {
  const ad = new ActiveDirectory({
    url: adConf.ad_url,
    baseDN: adConf.ad_base_dn,
    username: adConf.ad_username,
    password: adConf.ad_password,
    tlsOptions,
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

async function getAssignees() {
  if (cache.users && Date.now() - cache.at < CACHE_MS) return cache.users;

  const users = (await fetchGroupMembers())
    .filter((user) => user.sAMAccountName && !(Number(user.userAccountControl) & ACCOUNTDISABLE))
    .map(toAssignee)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  cache = { at: Date.now(), users };
  return users;
}

module.exports = {
  get: async function (req, res) {
    if (!adConf.ad_password) {
      return res.status(500).json({ error: 'AD-uppslag är inte konfigurerat' });
    }
    try {
      res.status(200).json({ group: adConf.ad_group, items: await getAssignees() });
    } catch (err) {
      console.error('Error fetching assignees from AD:', err.message || err);
      // Hellre en något gammal lista än ingen alls om AD inte svarar
      if (cache.users) {
        return res.status(200).json({ group: adConf.ad_group, items: cache.users, stale: true });
      }
      res.status(502).json({ error: 'Kunde inte hämta handläggare från AD' });
    }
  },
};

module.exports.get.apiDoc = {
  description: 'List case officers (members of the configured AD group) that issues can be assigned to.',
  operationId: 'listAssignees',
  parameters: [],
  responses: {
    200: {
      description: 'Handläggarna, sorterade på namn. items: [{ username, name, email }]',
      schema: { type: 'object' },
    },
    500: { description: 'Server error', schema: { type: 'object' } },
    502: { description: 'AD svarade inte', schema: { type: 'object' } },
  },
};
