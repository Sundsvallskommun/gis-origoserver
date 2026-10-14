const { pool, COLUMNS, parseId, idParameter } = require('../../reportIssues');

module.exports = {
  get: async function (req, res) {
    const id = parseId(req, res);
    if (id === null) return;

    try {
      const result = await pool.query(
        `SELECT ${COLUMNS} FROM intern."LANT_report_issues" WHERE id = $1`,
        [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Ärendet finns inte' });
      }
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Database error' });
    }
  },
};

module.exports.get.apiDoc = {
  description: 'Get a reported issue.',
  operationId: 'getReport',
  parameters: [idParameter],
  responses: {
    200: { description: 'Ärendet.', schema: { type: 'object' } },
    400: { description: 'Bad request', schema: { type: 'object' } },
    404: { description: 'Ärendet finns inte', schema: { type: 'object' } },
    500: { description: 'Server error', schema: { type: 'object' } },
  },
};
