const { PRIORITIES, parseId, updateReport, idParameter, responses } = require('../../../reportIssues');

module.exports = {
  patch: async function (req, res) {
    const id = parseId(req, res);
    if (id === null) return;

    const priority = req.body && req.body.priority;
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Ogiltig prioritet, tillåtna värden: ${PRIORITIES.join(', ')}` });
    }

    await updateReport(req, res, id, 'priority = $2', [priority]);
  },
};

module.exports.patch.apiDoc = {
  description: 'Set the priority of a reported issue.',
  operationId: 'setReportPriority',
  parameters: [
    idParameter,
    {
      in: 'body',
      name: 'body',
      required: true,
      schema: {
        type: 'object',
        required: ['priority'],
        properties: {
          priority: { type: 'string', enum: PRIORITIES },
        },
      },
    },
  ],
  responses,
};
