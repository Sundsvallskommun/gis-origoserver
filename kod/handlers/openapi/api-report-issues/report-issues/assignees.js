const conf = require('../../../../conf/config');
const { getAssignees, cachedAssignees } = require('../../reportIssuesAd');

const adConf = conf['reportIssues'];

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
      if (cachedAssignees()) {
        return res.status(200).json({ group: adConf.ad_group, items: cachedAssignees(), stale: true });
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
