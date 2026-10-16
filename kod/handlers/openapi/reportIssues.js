const conf = require('../../conf/config');
const { Pool } = require('pg');

const dbConf = conf['reportIssues'];
const pool = new Pool({
  host: dbConf.db_host,
  port: dbConf.db_port,
  database: dbConf.db_database,
  user: dbConf.db_username,
  password: dbConf.db_password,
  ssl: false,
});

// Måste matcha CHECK-villkoren på intern."LANT_report_issues"
const STATUSES = ['ny', 'pågår', 'väntar', 'löst', 'avvisad', 'stängd'];
const CLOSED_STATUSES = ['löst', 'avvisad', 'stängd'];
const PRIORITIES = ['låg', 'normal', 'hög'];

const COLUMNS = `
  id, arende_nummer, anmalares_namn, anmalares_epost, rapport, kartalank,
  status, priority, kategori, tilldelad_till, tilldelad_vid,
  skapad_av, skapad_datum, modifierad_av, modifierad_datum, stangd_vid`;

// Tomma strängar blir NULL
const orNull = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Ogiltigt id' });
    return null;
  }
  return id;
}

// Kör en UPDATE mot ett ärende och svarar med den uppdaterade raden.
// Den inloggade användaren (req.user, satt av reportIssuesAuth) sätts i transaktionsvariabeln
// report_issues.user, som triggern på tabellen skriver till modifierad_av (se sql/report-issues).
async function updateReport(req, res, id, setClause, values) {
  const sql = `
    UPDATE intern."LANT_report_issues"
    SET ${setClause}
    WHERE id = $1
    RETURNING ${COLUMNS}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.user && req.user.username) {
      await client.query("SELECT set_config('report_issues.user', $1, true)", [req.user.username]);
    }
    const result = await client.query(sql, [id, ...values]);
    await client.query('COMMIT');
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ärendet finns inte' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error executing query:', err);
    // 23514 = check_violation
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Ogiltiga uppgifter', constraint: err.constraint });
    }
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
}

const idParameter = {
  in: 'path',
  name: 'id',
  required: true,
  type: 'integer',
  description: 'Ärendets id',
};

const responses = {
  200: { description: 'Det uppdaterade ärendet.', schema: { type: 'object' } },
  400: { description: 'Bad request', schema: { type: 'object' } },
  404: { description: 'Ärendet finns inte', schema: { type: 'object' } },
  500: { description: 'Server error', schema: { type: 'object' } },
};

module.exports = {
  pool,
  COLUMNS,
  STATUSES,
  CLOSED_STATUSES,
  PRIORITIES,
  orNull,
  parseId,
  updateReport,
  idParameter,
  responses,
};
