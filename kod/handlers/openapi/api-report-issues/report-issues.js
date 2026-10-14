const conf = require("../../../conf/config");
//const url = require('url');
const nodemailer = require("nodemailer");
const { pool, COLUMNS, STATUSES, PRIORITIES, orNull } = require("../reportIssues");

// Skickar e-post om ärendet. Svaret till klienten skickas av saveReport.
function sendReport(name, email, report, maplink, caseNumber) {
  const configOptions = Object.assign({}, conf["reportIssues"]);
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
    html: `<p>Namn: ${name}</p><p>Email: ${email}</p><p>Ärendenummer: ${caseNumber}</p><p>Problem: ${report}</p><p>Kartlänk: <a href="${maplink}">${maplink}</a></p>`,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log("Fel:", error);
    }
    console.log("E-post skickat:", info.messageId);
  });
}

// Sparar ärendet och svarar klienten. Returnerar true om ärendet sparades.
async function saveReport(res, name, email, report, maplink, caseNumber) {
  const sql = `
    INSERT INTO intern."LANT_report_issues"
      (arende_nummer, rapport, kartalank, anmalares_namn, anmalares_epost)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (arende_nummer) DO NOTHING
    RETURNING id`;

  const values = [caseNumber, report, orNull(maplink), orNull(name), orNull(email)];

  try {
    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      res.status(409).json({ error: "Ärendenumret finns redan" });
      return false;
    }

    console.log("Report saved to database, id", result.rows[0].id);
    res.status(201).json({ status: "ok", id: result.rows[0].id });
    return true;
  } catch (err) {
    console.error("Error executing query:", err);

    // 23514 = check_violation, t.ex. e-post utan namn
    if (err.code === "23514") {
      res.status(400).json({ error: "Ogiltiga uppgifter", constraint: err.constraint });
    } else {
      res.status(500).json({ error: "Database error" });
    }
    return false;
  }
}

// Filter för listningen: queryparameter -> kolumn
const LIST_FILTERS = {
  status: "status",
  priority: "priority",
  category: "kategori",
  assignee: "tilldelad_till",
};

async function listReports(req, res) {
  const where = [];
  const values = [];
  for (const [param, column] of Object.entries(LIST_FILTERS)) {
    if (req.query[param] !== undefined) {
      values.push(req.query[param]);
      where.push(`${column} = $${values.length}`);
    }
  }
  if (req.query.open !== undefined) {
    where.push(req.query.open === "true" ? "stangd_vid IS NULL" : "stangd_vid IS NOT NULL");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Express 5 låter inte express-openapi konvertera query-parametrar, så talen tolkas här
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 100;
  const offset = req.query.offset !== undefined ? Number(req.query.offset) : 0;
  if (limit < 1 || limit > 1000) {
    return res.status(400).json({ error: "limit måste vara mellan 1 och 1000" });
  }

  try {
    const total = await pool.query(
      `SELECT count(*)::int AS total FROM intern."LANT_report_issues" ${whereSql}`,
      values,
    );
    const result = await pool.query(
      `
      SELECT ${COLUMNS}
      FROM intern."LANT_report_issues"
      ${whereSql}
      ORDER BY skapad_datum DESC, id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    res.status(200).json({ total: total.rows[0].total, limit, offset, items: result.rows });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).json({ error: "Database error" });
  }
}

module.exports = {
  get: listReports,
  put: async function (req, res) {
    const data = req.body || {};
    for (const param of ["name", "email", "report", "caseNumber"]) {
      if (!(param in data)) {
        return res.status(400).json({ error: `Missing required parameter ${param}` });
      }
    }
    const { name, email, report, caseNumber } = data;
    const maplink = "maplink" in data ? data.maplink : "";

    // E-post skickas bara för ärenden som faktiskt sparats, så att dubbletter inte ger nya mejl
    if (await saveReport(res, name, email, report, maplink, caseNumber)) {
      sendReport(name, email, report, maplink, caseNumber);
    }
  },
};

module.exports.get.apiDoc = {
  description: "List reported issues, newest first.",
  operationId: "listReports",
  parameters: [
    { in: "query", name: "status", required: false, type: "string", enum: STATUSES },
    { in: "query", name: "priority", required: false, type: "string", enum: PRIORITIES },
    { in: "query", name: "category", required: false, type: "string" },
    { in: "query", name: "assignee", required: false, type: "string", description: "Handläggare" },
    {
      in: "query",
      name: "open",
      required: false,
      type: "string",
      enum: ["true", "false"],
      description: "true = bara öppna ärenden, false = bara stängda",
    },
    {
      in: "query",
      name: "limit",
      required: false,
      type: "string",
      pattern: "^[0-9]+$",
      description: "Max antal ärenden, 1-1000 (standard 100)",
    },
    {
      in: "query",
      name: "offset",
      required: false,
      type: "string",
      pattern: "^[0-9]+$",
      description: "Antal ärenden att hoppa över (standard 0)",
    },
  ],
  responses: {
    200: { description: "Ärendena och totalt antal träffar.", schema: { type: "object" } },
    400: { description: "Bad request", schema: { type: "object" } },
    500: { description: "Server error", schema: { type: "object" } },
  },
};

module.exports.put.apiDoc = {
  description: "Handle issues reported by users of Origo map.",
  operationId: "saveReport",
  parameters: [
    {
      in: "body",
      name: "name",
      required: true,
      schema: { $ref: "#/definitions/Name" },
    },
    {
      in: "body",
      name: "report",
      required: false,
      schema: { $ref: "#/definitions/Report" },
    },
    {
      in: "body",
      name: "maplink",
      required: false,
      schema: { $ref: "#/definitions/MapLink" },
    },
  ],
  responses: {
    200: {
      description: "Saves the report.",
      schema: {
        type: "string",
      },
    },
    400: {
      description: "Bad request",
      schema: {
        type: "string",
      },
    },
    500: {
      description: "Server error",
      schema: {
        type: "string",
      },
    },
  },
};
