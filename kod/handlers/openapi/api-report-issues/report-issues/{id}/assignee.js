const { orNull, parseId, updateReport, idParameter, responses } = require('../../../reportIssues');

module.exports = {
  patch: async function (req, res) {
    const id = parseId(req, res);
    if (id === null) return;

    if (!req.body || !('assignee' in req.body)) {
      return res.status(400).json({ error: 'Missing required parameter assignee' });
    }
    const assignee = req.body.assignee;
    if (assignee !== null && typeof assignee !== 'string') {
      return res.status(400).json({ error: 'assignee måste vara en sträng eller null' });
    }

    // tilldelad_vid uppdateras bara när handläggaren byts, och nollas när tilldelningen tas bort
    await updateReport(req, res, id, `
      tilldelad_till = $2::text,
      tilldelad_vid = CASE
        WHEN $2::text IS NULL THEN NULL
        WHEN tilldelad_till IS DISTINCT FROM $2::text THEN now()
        ELSE tilldelad_vid
      END`,
      [orNull(assignee)]);
  },
};

module.exports.patch.apiDoc = {
  description: 'Assign a reported issue to a case officer. null or an empty string removes the assignment.',
  operationId: 'setReportAssignee',
  parameters: [
    idParameter,
    {
      in: 'body',
      name: 'body',
      required: true,
      schema: {
        type: 'object',
        required: ['assignee'],
        properties: {
          assignee: { description: 'Handläggare som sträng, eller null för att ta bort tilldelningen' },
        },
      },
    },
  ],
  responses,
};
