// Turns the OpenAPI document into Express middleware: request validation per operation
// (path and header parameters, content type, body) and, optionally, response validation.
// Only what this API uses is supported: parameters in path and header with a schema, JSON
// request bodies, and raw bodies for "*/*".

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_BASE = 'urn:dialogkarta:openapi';
const JSON_TYPES = ['application/json', 'application/geo+json'];
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'];

class ValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function resolveRef(doc, obj) {
  if (!obj || !obj.$ref) return obj;
  const target = obj.$ref.replace(/^#\//, '').split('/').reduce((node, key) => node?.[key], doc);
  if (!target) throw new Error(`Unresolved $ref ${obj.$ref}`);
  return resolveRef(doc, target);
}

const mediaType = (header) => (header || '').split(';')[0].trim().toLowerCase();

function createOpenApi(doc) {
  const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: false });
  addFormats(ajv);
  // The schemas are reached through #/components/schemas/..., so they're registered inside a
  // wrapper with the same layout as the document.
  ajv.addKeyword('components');
  ajv.addSchema({ $id: SCHEMA_BASE, components: { schemas: doc.components.schemas } });

  // Schemas in the document refer to each other with "#/components/...". Inside the wrapper
  // that already resolves; a schema compiled on its own gets the refs made absolute.
  function compile(schema) {
    const absolute = JSON.parse(JSON.stringify(schema).replace(/"#\/components\//g, `"${SCHEMA_BASE}#/components/`));
    return ajv.compile(absolute);
  }

  // Last error, since for oneOf Ajv reports the branches first and the summary last.
  function describe(errors, where) {
    const err = errors[errors.length - 1];
    return `${where}${err.instancePath} ${err.message}`;
  }

  function operations() {
    const ops = [];
    Object.entries(doc.paths).forEach(([path, rawItem]) => {
      const item = resolveRef(doc, rawItem);
      METHODS.filter((m) => item[m]).forEach((method) => {
        const op = item[method];
        // Operation parameters override path-level ones with the same name and location.
        const params = new Map();
        [...(item.parameters || []), ...(op.parameters || [])].map((p) => resolveRef(doc, p))
          .forEach((p) => params.set(`${p.in}:${p.name}`, p));
        ops.push({
          path, method, op, parameters: [...params.values()], security: op.security ?? doc.security ?? []
        });
      });
    });
    return ops;
  }

  function requestValidator({ parameters, op }) {
    const checks = parameters.map((p) => {
      if (!['path', 'header'].includes(p.in)) throw new Error(`Parameters in ${p.in} are not supported`);
      return { param: p, validate: compile(p.schema || {}) };
    });
    const body = op.requestBody && resolveRef(doc, op.requestBody);
    const bodyTypes = body ? Object.keys(body.content) : [];
    const bodyChecks = Object.fromEntries(bodyTypes
      .filter((type) => JSON_TYPES.includes(type))
      .map((type) => [type, compile(body.content[type].schema || {})]));

    return function validateRequest(req, res, next) {
      try {
        checks.forEach(({ param, validate }) => {
          const value = param.in === 'path' ? req.params[param.name] : req.get(param.name);
          if (value === undefined) {
            if (param.required) throw new ValidationError(400, `Missing ${param.in} parameter ${param.name}`);
            return;
          }
          if (!validate(value)) throw new ValidationError(400, describe(validate.errors, `${param.in} parameter ${param.name}`));
        });
        if (body) {
          const type = mediaType(req.get('Content-Type'));
          const hasBody = Buffer.isBuffer(req.body) ? req.body.length > 0 : req.body !== undefined;
          if (!bodyTypes.includes('*/*') && !bodyTypes.includes(type)) {
            throw new ValidationError(415, `Content-Type must be one of ${bodyTypes.join(', ')}`);
          }
          if (body.required && !hasBody) throw new ValidationError(400, 'Request body is required');
          const validate = bodyChecks[type];
          if (validate && !validate(req.body)) throw new ValidationError(400, describe(validate.errors, 'body'));
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  // Wraps res.json so every JSON response is checked against the documented response for its
  // status code. mode 'warn' logs, 'strict' replaces the response with a 500 - for tests.
  function responseValidator({ op, method, path }, mode) {
    const cache = {};
    function validatorFor(status, type) {
      const key = `${status} ${type}`;
      if (!(key in cache)) {
        const documented = op.responses[status] || op.responses[`${String(status)[0]}XX`] || op.responses.default;
        const resp = documented && resolveRef(doc, documented);
        const media = resp?.content?.[type] || resp?.content?.['*/*'];
        if (!resp) cache[key] = () => `status ${status} is not documented`;
        else if (!media) cache[key] = () => `content type ${type} is not documented for ${status}`;
        else {
          const validate = compile(media.schema || {});
          cache[key] = (data) => (validate(data) ? null : describe(validate.errors, 'response'));
        }
      }
      return cache[key];
    }

    return function validateResponse(req, res, next) {
      const json = res.json.bind(res);
      res.json = (data) => {
        const type = mediaType(res.get('Content-Type')) || 'application/json';
        const problem = validatorFor(res.statusCode, type)(JSON.parse(JSON.stringify(data)));
        if (problem) {
          const message = `${method.toUpperCase()} ${path} (${op.operationId}): ${problem}`;
          console.error(`OpenAPI response mismatch: ${message}`);
          if (mode === 'strict') {
            res.status(500).type('application/json');
            return json({ error: `Response does not match the API description: ${message}` });
          }
        }
        return json(data);
      };
      next();
    };
  }

  return {
    operations, requestValidator, responseValidator, resolveRef: (obj) => resolveRef(doc, obj)
  };
}

module.exports = { createOpenApi, ValidationError, JSON_TYPES };
