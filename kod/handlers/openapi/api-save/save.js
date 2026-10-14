const conf = require('../../../conf/config');
//const url = require('url');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const dbConf = conf['apiSave'];
const pool = new Pool({
  host: dbConf.db_host,
  port: dbConf.db_port,
  database: dbConf.db_database,
  user: dbConf.db_username,
  password: dbConf.db_password,
  ssl: false,
});

function sendReport(req, res, name, email, report, maplink, caseNumber) {
    const configOptions = Object.assign({}, conf['apiSave']);
    let transporter = nodemailer.createTransport({
        host: configOptions.smtp_host,
        port: configOptions.smtp_port,
        secure: false,
    });
    let mailOptions = {
        from: configOptions.mail_from,
        to: configOptions.mail_to,
        subject: `${configOptions.msg_subject} (${caseNumber})`,
        text: `Namn: ${name}\r\nEmail: ${email}\r\nProblem: ${report}\r\nKartlänk: ${maplink}\r\nÄrendenummer: ${caseNumber}`,
        html: `<p>Namn: ${name}</p><p>Email: ${email}</p><p>Ärendenummer: ${caseNumber}</p><p>Problem: ${report}</p><p>Kartlänk: <a href="${maplink}">${maplink}</a></p>`
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Fel:', error);
        }
        console.log('E-post skickat:', info.messageId);
    });
    res.status(200).json({status: 'ok'});
}

// Tomma strängar blir NULL, så att CHECK-villkoren och anonyma ärenden fungerar
const orNull = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

async function saveReport(req, res, name, email, report, maplink, caseNumber) {
  const sql = `
    INSERT INTO intern."LANT_report_issues"
      (arende_nummer, rapport, kartalank, anmalares_namn, anmalares_epost)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (arende_nummer) DO NOTHING
    RETURNING id`;

  const values = [
    caseNumber,
    report,
    orNull(maplink),
    orNull(name),
    orNull(email),
  ];

  try {
    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'Ärendenumret finns redan' });
    }

    console.log('Report saved to database, id', result.rows[0].id);
    res.status(201).json({ status: 'ok', id: result.rows[0].id });
  } catch (err) {
    console.error('Error executing query:', err);

    // 23514 = check_violation, t.ex. e-post utan namn
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Ogiltiga uppgifter', constraint: err.constraint });
    }
    res.status(500).json({ error: 'Database error' });
  }
}

module.exports = {
  put: async function (req, res, next) {
    const data = req.body;
    console.log(data);
    let name = '';
    let email = '';
    let report = '';
    let maplink = '';
    let caseNumber = '';
    if ('name' in data) {
      name = data.name;
    } else {
        next(new Error(`Missing required parameter name`));
        res.status(400).json({error: 'Missing required parameter name'});
    }
    if ('email' in data) {
      email = data.email;
    } else {
        next(new Error(`Missing required parameter email`));
        res.status(400).json({error: 'Missing required parameter email'});
    }
    if ('report' in data) {
      report = data.report;
    } else {
        next(new Error(`Missing required parameter report`));
        res.status(400).json({error: 'Missing required parameter report'});
    }
    if ('caseNumber' in data) {
      caseNumber = data.caseNumber;
    } else {
        next(new Error(`Missing required parameter caseNumber`));
        res.status(400).json({error: 'Missing required parameter caseNumber'});
    }
    if ('maplink' in data) {
      maplink = data.maplink;
    }
    await saveReport(req, res, name, email, report, maplink, caseNumber);
    sendReport(req, res, name, email, report, maplink, caseNumber);
    // res.status(200).json({detaljplan: false});
  },
};

module.exports.put.apiDoc = {
  description: 'Handle issues reported by users of Origo map.',
  operationId: 'saveReport',
  parameters: [
        {
            in: 'body',
            name: 'name',
            required: true,
            schema: { $ref: '#/definitions/Name'}
        },
        {
            in: 'body',
            name: 'report',
            required: false,
            schema: { $ref: '#/definitions/Report'}
        },
        {
            in: 'body',
            name: 'maplink',
            required: false,
            schema: { $ref: '#/definitions/MapLink'}
        }
    ],
  responses: {
    200: {
      description: 'Saves the report.',
      schema: {
        type: 'string',
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: 'string',
      },
    },
    500: {
      description: 'Server error',
      schema: {
        type: 'string',
      },
    },
  },
};
