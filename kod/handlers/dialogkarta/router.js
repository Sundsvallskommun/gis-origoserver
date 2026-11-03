// REST API for the dialogs, built from the OpenAPI 3.2 document in openapi.js: every path and
// operation there becomes a route, every request is validated against it before the handler
// runs, and the handlers below are looked up by operationId. Mount it where the plugin's
// apiUrl points:
//
//   app.use('/origoserver/api/v1/dialogs', createDialogRouter({ store, requireWrite }));
//
// Operations with a security requirement in the document go through requireWrite, so the host
// app decides who may edit (an API token, an AD group, a logged-in session ...).

const express = require('express');
const { randomUUID } = require('node:crypto');
const apiDoc = require('./openapi');
const { createOpenApi, JSON_TYPES } = require('./openapi-validator');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SERVER_MANAGED = ['attachments', 'createdAt', 'updatedAt'];

// The request is already valid against the schema; this only drops what the server manages
// itself and normalises the archive fields.
function cleanFeature(body, id) {
  const properties = { ...body.properties };
  SERVER_MANAGED.forEach((key) => delete properties[key]);
  properties.archived = properties.archived === true;
  if (!properties.archived) properties.archivedAt = null;
  return {
    type: 'Feature', id, geometry: body.geometry ?? null, properties
  };
}

function decodeFilename(header) {
  let name = '';
  try {
    name = decodeURIComponent(header || '');
  } catch {
    name = header || '';
  }
  // No paths, no control characters.
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'fil';
}

const sendFeature = (res, status, feature) => res.status(status).type('application/geo+json').json(feature);

function createHandlers({ store, getUser, document }) {
  return {
    getOpenApiDocument(req, res) {
      // The servers entry points at wherever the router is mounted.
      res.json({ ...document, servers: [{ url: req.baseUrl || '/' }] });
    },

    async listDialogs(req, res) {
      sendFeature(res, 200, { type: 'FeatureCollection', features: await store.list() });
    },

    async getDialog(req, res) {
      const feature = await store.get(req.params.id);
      if (!feature) throw new HttpError(404, 'Not found');
      sendFeature(res, 200, feature);
    },

    async createDialog(req, res) {
      const id = req.body.id ?? randomUUID();
      const feature = cleanFeature(req.body, id);
      const user = getUser(req);
      if (user) {
        feature.properties.createdBy = user;
        feature.properties.updatedBy = user;
      }
      if (await store.get(id)) throw new HttpError(409, 'A dialog with this id already exists');
      const saved = await store.create(feature);
      res.location(`${req.baseUrl}/${encodeURIComponent(id)}`);
      sendFeature(res, 201, saved);
    },

    async replaceDialog(req, res) {
      const { id } = req.params;
      const existing = await store.get(id);
      if (!existing) throw new HttpError(404, 'Not found');
      // The id in the path wins over one in the body.
      const feature = cleanFeature(req.body, id);
      // Who created it can't be changed by a later save.
      feature.properties.createdBy = existing.properties.createdBy;
      const user = getUser(req);
      if (user) feature.properties.updatedBy = user;
      sendFeature(res, 200, await store.update(feature));
    },

    async deleteDialog(req, res) {
      if (!await store.remove(req.params.id)) throw new HttpError(404, 'Not found');
      res.status(204).end();
    },

    async addAttachment(req, res) {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Empty file');
      const attachment = {
        id: randomUUID(),
        name: decodeFilename(req.get('X-Filename')),
        type: (req.get('Content-Type') || 'application/octet-stream').slice(0, 200),
        size: req.body.length,
        createdAt: new Date().toISOString(),
        createdBy: getUser(req) ?? null
      };
      const saved = await store.addAttachment(req.params.id, attachment, req.body);
      if (!saved) throw new HttpError(404, 'Not found');
      res.status(201).json(saved);
    },

    async getAttachment(req, res) {
      const file = await store.getAttachment(req.params.id, req.params.attachmentId);
      if (!file) throw new HttpError(404, 'Not found');
      // Always a download: an uploaded HTML or SVG file must not run in the map's origin.
      res.set({
        'Content-Type': file.attachment.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.attachment.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox"
      });
      res.send(file.data);
    },

    async deleteAttachment(req, res) {
      if (!await store.removeAttachment(req.params.id, req.params.attachmentId)) throw new HttpError(404, 'Not found');
      res.status(204).end();
    }
  };
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// "/{id}/attachments" -> "/:id/attachments"
const expressPath = (path) => path.replace(/\{(\w+)\}/g, ':$1');

function createDialogRouter({
  store,
  requireWrite = (req, res, next) => next(),
  maxAttachmentSize = 25 * 1024 * 1024,
  maxBodySize = '5mb',
  getUser = () => undefined,
  // false, 'warn' (log mismatches) or 'strict' (answer 500 on a mismatch, for tests)
  validateResponses = false,
  document = apiDoc
}) {
  if (!store) throw new Error('createDialogRouter needs a store');
  const openapi = createOpenApi(document);
  const handlers = createHandlers({ store, getUser, document });
  const router = express.Router();

  const jsonBody = express.json({ limit: maxBodySize, type: JSON_TYPES });
  const rawBody = express.raw({ type: () => true, limit: maxAttachmentSize });

  const operations = openapi.operations();
  const documented = new Set(operations.map((o) => o.op.operationId));
  const missing = [...documented].filter((id) => !handlers[id]);
  const extra = Object.keys(handlers).filter((id) => !documented.has(id));
  if (missing.length || extra.length) {
    throw new Error(`Handlers and openapi.js differ. Missing handlers: ${missing.join(', ') || '-'}; not documented: ${extra.join(', ') || '-'}`);
  }

  // Fixed paths before paths with parameters, so /openapi.json isn't taken for an /{id}.
  operations
    .sort((a, b) => Number(a.path.includes('{')) - Number(b.path.includes('{')))
    .forEach((operation) => {
      const { op, method, path } = operation;
      const middleware = [];
      if (validateResponses) middleware.push(openapi.responseValidator(operation, validateResponses));
      if (operation.security.length > 0) middleware.push(requireWrite);
      const body = op.requestBody && openapi.resolveRef(op.requestBody);
      if (body) middleware.push(Object.keys(body.content).includes('*/*') ? rawBody : jsonBody);
      middleware.push(openapi.requestValidator(operation));
      router[method](expressPath(path), ...middleware, wrap(handlers[op.operationId]));
    });

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('Dialogkarta API:', err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return router;
}

module.exports = {
  createDialogRouter, cleanFeature, HttpError, apiDoc
};
