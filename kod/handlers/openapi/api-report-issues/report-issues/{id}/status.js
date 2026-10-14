const { STATUSES, CLOSED_STATUSES, parseId, updateReport, idParameter, responses } = require('../../../reportIssues');

module.exports = {
  patch: async function (req, res) {
    const id = parseId(req, res);
    if (id === null) return;

    const status = req.body && req.body.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `Ogiltig status, tillåtna värden: ${STATUSES.join(', ')}` });
    }

    // stangd_vid sätts när ärendet stängs och nollas när det öppnas igen
    await updateReport(res, id, `
      status = $2,
      stangd_vid = CASE WHEN $2 = ANY($3::text[]) THEN COALESCE(stangd_vid, now()) ELSE NULL END`,
      [status, CLOSED_STATUSES]);
  },
};

module.exports.patch.apiDoc = {
  description: 'Set the status of a reported issue.',
  operationId: 'setReportStatus',
  parameters: [
    idParameter,
    {
      in: 'body',
      name: 'body',
      required: true,
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: STATUSES },
        },
      },
    },
  ],
  responses,
};
