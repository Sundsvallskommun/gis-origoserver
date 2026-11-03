// Stores the dialogs in PostgreSQL/PostGIS, see sql/schema.sql. Takes an existing pg Pool,
// so it can share the connection pool of the host app (e.g. origoserver's reportIssues pool).

const COLUMNS = {
  title: 'titel',
  area: 'omrade',
  method: 'metod',
  status: 'status',
  startDate: 'startdatum',
  endDate: 'slutdatum',
  organizer: 'ansvarig',
  targetGroup: 'malgrupp',
  participants: 'antal_deltagare',
  description: 'beskrivning',
  dialogUrl: 'dialog_url',
  result: 'resultat',
  resultUrl: 'resultat_url',
  archived: 'arkiverad',
  archivedAt: 'arkiverad_tid',
  createdBy: 'skapad_av',
  updatedBy: 'andrad_av'
};
const PROPS = Object.keys(COLUMNS);
const IDENT = /^[a-z_][a-z0-9_]*$/;

const iso = (value) => (value instanceof Date ? value.toISOString() : value);
const emptyToNull = (value) => (value === '' || value === undefined ? null : value);

function createPgStore({ pool, schema = 'dialog', srid = 3014 }) {
  if (!IDENT.test(schema)) throw new Error(`Invalid schema name: ${schema}`);
  if (!Number.isInteger(srid)) throw new Error(`Invalid srid: ${srid}`);
  const dialogs = `${schema}.dialoger`;
  const attachments = `${schema}.bilagor`;

  const select = `
    SELECT d.*, to_char(d.startdatum, 'YYYY-MM-DD') AS start_text, to_char(d.slutdatum, 'YYYY-MM-DD') AS slut_text,
      ST_AsGeoJSON(d.geom)::json AS geojson,
      COALESCE((SELECT json_agg(json_build_object('id', b.id, 'name', b.namn, 'type', b.typ, 'size', b.storlek,
        'createdAt', b.skapad_tid, 'createdBy', b.skapad_av) ORDER BY b.skapad_tid)
        FROM ${attachments} b WHERE b.dialog_id = d.id), '[]'::json) AS bilagor
    FROM ${dialogs} d`;

  function toFeature(row) {
    const properties = { ...row.ovrigt };
    PROPS.forEach((prop) => { properties[prop] = iso(row[COLUMNS[prop]]); });
    properties.startDate = row.start_text || '';
    properties.endDate = row.slut_text || '';
    properties.attachments = row.bilagor;
    properties.createdAt = iso(row.skapad_tid);
    properties.updatedAt = iso(row.andrad_tid);
    return {
      type: 'Feature', id: row.id, geometry: row.geojson, properties
    };
  }

  function toValues(feature) {
    const extra = {};
    Object.entries(feature.properties).forEach(([key, value]) => {
      if (!PROPS.includes(key)) extra[key] = value;
    });
    return [
      feature.id,
      ...PROPS.map((prop) => emptyToNull(feature.properties[prop])),
      extra,
      feature.geometry ? JSON.stringify(feature.geometry) : null
    ];
  }

  const columnList = PROPS.map((p) => COLUMNS[p]);
  const geomParam = `$${PROPS.length + 3}`;
  const geomExpr = `CASE WHEN ${geomParam}::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON(${geomParam}::text), ${srid}) END`;

  async function get(id) {
    const { rows } = await pool.query(`${select} WHERE d.id = $1`, [id]);
    return rows[0] ? toFeature(rows[0]) : null;
  }

  return {
    async list() {
      const { rows } = await pool.query(`${select} ORDER BY d.startdatum DESC NULLS LAST, d.titel`);
      return rows.map(toFeature);
    },

    get,

    async create(feature) {
      const params = columnList.map((c, i) => `$${i + 2}`).join(', ');
      await pool.query(
        `INSERT INTO ${dialogs} (id, ${columnList.join(', ')}, ovrigt, geom)
         VALUES ($1, ${params}, $${PROPS.length + 2}, ${geomExpr})`,
        toValues(feature)
      );
      return get(feature.id);
    },

    async update(feature) {
      const sets = columnList
        .filter((c) => c !== 'skapad_av' && c !== 'arkiverad_tid')
        .map((c) => `${c} = $${columnList.indexOf(c) + 2}`);
      const param = (column) => `$${columnList.indexOf(column) + 2}`;
      // In SET, column names mean the old row, so the new archived flag is read from its parameter.
      // The creator is only filled in if it's missing; every parameter has to be used for pg to type it.
      const { rowCount } = await pool.query(
        `UPDATE ${dialogs} SET ${sets.join(', ')},
           arkiverad_tid = CASE WHEN ${param('arkiverad')}::boolean THEN COALESCE(arkiverad_tid, ${param('arkiverad_tid')}::timestamptz, now()) ELSE NULL END,
           skapad_av = COALESCE(skapad_av, ${param('skapad_av')}),
           ovrigt = $${PROPS.length + 2}, geom = ${geomExpr}, andrad_tid = now()
         WHERE id = $1`,
        toValues(feature)
      );
      return rowCount ? get(feature.id) : null;
    },

    async remove(id) {
      const { rowCount } = await pool.query(`DELETE FROM ${dialogs} WHERE id = $1`, [id]);
      return rowCount > 0;
    },

    async addAttachment(id, attachment, data) {
      const { rowCount } = await pool.query(
        `INSERT INTO ${attachments} (id, dialog_id, namn, typ, storlek, data, skapad_tid, skapad_av)
         SELECT $1, d.id, $3, $4, $5, $6, $7, $8 FROM ${dialogs} d WHERE d.id = $2`,
        [attachment.id, id, attachment.name, attachment.type, attachment.size, data, attachment.createdAt, attachment.createdBy || null]
      );
      return rowCount ? attachment : null;
    },

    async getAttachment(id, attId) {
      const { rows } = await pool.query(
        `SELECT id, namn, typ, storlek, data FROM ${attachments} WHERE dialog_id = $1 AND id = $2`,
        [id, attId]
      );
      if (!rows[0]) return null;
      const row = rows[0];
      return {
        attachment: {
          id: row.id, name: row.namn, type: row.typ, size: row.storlek
        },
        data: row.data
      };
    },

    async removeAttachment(id, attId) {
      const { rowCount } = await pool.query(`DELETE FROM ${attachments} WHERE dialog_id = $1 AND id = $2`, [id, attId]);
      return rowCount > 0;
    }
  };
}

module.exports = { createPgStore };
