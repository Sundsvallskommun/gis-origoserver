const { orNull, parseId, updateReport, idParameter, responses } = require('../../../reportIssues');

module.exports = {
  patch: async function (req, res) {
    const id = parseId(req, res);
    if (id === null) return;

    if (!req.body || !('category' in req.body)) {
      return res.status(400).json({ error: 'Missing required parameter category' });
    }
    const category = req.body.category;
    if (category !== null && typeof category !== 'string') {
      return res.status(400).json({ error: 'category måste vara en sträng eller null' });
    }

    // null eller tom sträng tar bort kategorin
    await updateReport(req, res, id, 'kategori = $2', [orNull(category)]);
  },
};

module.exports.patch.apiDoc = {
  description: 'Set the category of a reported issue. null or an empty string clears it.',
  operationId: 'setReportCategory',
  parameters: [
    idParameter,
    {
      in: 'body',
      name: 'body',
      required: true,
      schema: {
        type: 'object',
        required: ['category'],
        properties: {
          category: { description: 'Kategori som sträng, eller null för att ta bort' },
        },
      },
    },
  ],
  responses,
};
