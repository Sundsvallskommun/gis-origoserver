// Medborgardialoger i kartan: API för Origo-pluginet Dialogkarta, monterat på
// /origoserver/api/v1/dialogs i app.js. Beskrivs av OpenAPI 3.2-dokumentet i openapi.js, som
// också styr routing och validering (se router.js), och serveras på .../dialogs/openapi.json.
//
// router.js, openapi.js, openapi-validator.js och stores/ kommer från dialog-karta (server/).
// Ändra där först och kopiera hit, så att de inte glider isär.

const path = require('path');

const MB = 1024 * 1024;

function createStore(dialogConf) {
  if (dialogConf.storage === 'file') {
    const { createFileStore } = require('./stores/file-store');
    return createFileStore({ dir: path.resolve(__dirname, '../..', dialogConf.data_dir || 'dialogkarta-data') });
  }
  const { Pool } = require('pg');
  const { createPgStore } = require('./stores/pg-store');
  const pool = new Pool({
    host: dialogConf.db_host,
    port: dialogConf.db_port,
    database: dialogConf.db_database,
    user: dialogConf.db_username,
    password: dialogConf.db_password,
    ssl: false,
  });
  pool.on('error', (err) => console.error('dialogkarta: fel i databasanslutningen:', err.message));
  return createPgStore({ pool, schema: dialogConf.db_schema || 'dialog', srid: dialogConf.srid || 3014 });
}

// requireAdGroupMember kan bytas ut i tester.
module.exports = function dialogkarta(dialogConf, {
  requireAdGroupMember = require('../auth/requireAdGroupMember'),
} = {}) {
  const { createDialogRouter } = require('./router');

  // Läsning är öppen. Ändringar kräver inloggning med en användare i ad_group (standard
  // reportIssues-gruppen), om inte require_login är false.
  const requireWrite = dialogConf.require_login === false
    ? (req, res, next) => next()
    : requireAdGroupMember({
      name: 'dialogkarta',
      forbidden: 'Du saknar behörighet att ändra medborgardialoger',
      adGroup: dialogConf.ad_group,
    });

  return createDialogRouter({
    store: createStore(dialogConf),
    requireWrite,
    getUser: (req) => req.user?.username,
    maxAttachmentSize: (dialogConf.max_attachment_mb || 25) * MB,
    validateResponses: dialogConf.validate_responses || false,
  });
};
