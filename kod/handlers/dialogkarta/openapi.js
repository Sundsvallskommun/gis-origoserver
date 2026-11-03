// OpenAPI 3.2 description of the dialog API. It is the source of truth for the server:
// router.js creates the routes from `paths`, checks every request against the schemas and,
// with validateResponses, every response too. Change the API here first.
//
// A JS module rather than JSON so it can carry comments; GET /openapi.json serves it as JSON.
// The schemas are plain JSON Schema 2020-12 (see jsonSchemaDialect), validated with Ajv.

const ID_PATTERN = '^[A-Za-z0-9_-]{1,64}$';
const DATE_OR_EMPTY = '^(\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01]))?$';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const geojson = (schema) => ({ 'application/geo+json': { schema } });
const writeSecurity = [{ bearerAuth: [] }];

// GeoJSON geometries as in RFC 7946.
const position = { type: 'array', minItems: 2, maxItems: 3, items: { type: 'number' } };
const ring = { type: 'array', minItems: 4, items: ref('Position') };
const geometry = (type, coordinates) => ({
  type: 'object',
  required: ['type', 'coordinates'],
  properties: {
    type: { const: type },
    coordinates,
    bbox: { type: 'array', items: { type: 'number' } }
  }
});

// The dialog's properties. In a request the server-managed (readOnly) properties are accepted
// but ignored, as OpenAPI says, so a client can send back what it got; in a response they are
// checked like the rest.
const dialogProperties = (forRequest) => {
  const readOnly = (schema) => (forRequest
    ? { readOnly: true, description: `${schema.description || 'Sätts av servern.'} Ignoreras i anrop.` }
    : { readOnly: true, ...schema });
  return {
    type: 'object',
    description: 'Egenskaper som inte står här får finnas om de är enkla värden; de sparas oförändrade.',
    required: ['title'],
    properties: {
      title: {
        type: 'string', minLength: 1, maxLength: 300, pattern: '\\S', description: 'Namn på dialogen.'
      },
      area: { type: ['string', 'null'], maxLength: 300, description: 'Område/plats.' },
      method: {
        type: ['string', 'null'],
        maxLength: 50,
        description: 'Metod. Pluginets koder: map, workshop, survey, meeting, walk, onsite, digital, other.',
        examples: ['map']
      },
      status: { enum: ['planned', 'ongoing', 'completed'], default: 'planned' },
      startDate: {
        type: ['string', 'null'], pattern: DATE_OR_EMPTY, description: 'ÅÅÅÅ-MM-DD eller tom.'
      },
      endDate: {
        type: ['string', 'null'], pattern: DATE_OR_EMPTY, description: 'ÅÅÅÅ-MM-DD eller tom.'
      },
      organizer: { type: ['string', 'null'], maxLength: 300, description: 'Ansvarig förvaltning/enhet.' },
      targetGroup: { type: ['string', 'null'], maxLength: 300, description: 'Målgrupp.' },
      participants: { type: ['integer', 'null'], minimum: 0, description: 'Antal deltagare/svar.' },
      description: { type: ['string', 'null'], maxLength: 20000 },
      dialogUrl: {
        type: ['string', 'null'], maxLength: 2000, pattern: '^(https?://\\S+)?$', description: 'Länk till dialogen.'
      },
      result: { type: ['string', 'null'], maxLength: 50000, description: 'Sammanfattning av resultatet.' },
      resultUrl: {
        type: ['string', 'null'], maxLength: 2000, pattern: '^(https?://\\S+)?$', description: 'Länk till resultatrapport.'
      },
      archived: { type: 'boolean', default: false, description: 'Avslutad och arkiverad.' },
      archivedAt: {
        type: ['string', 'null'], format: 'date-time', description: 'När den arkiverades. Sätts av servern om den saknas.'
      },
      createdBy: {
        type: ['string', 'null'], maxLength: 200, description: 'Skaparen. Sätts av servern om den vet vem som är inloggad.'
      },
      updatedBy: {
        type: ['string', 'null'], maxLength: 200, description: 'Senast ändrad av. Sätts av servern om den vet vem som är inloggad.'
      },
      attachments: readOnly({ type: 'array', items: ref('Attachment'), description: 'Bilagorna. Hanteras via /attachments.' }),
      createdAt: readOnly({ type: 'string', format: 'date-time' }),
      updatedAt: readOnly({ type: 'string', format: 'date-time' })
    },
    additionalProperties: { type: ['string', 'number', 'boolean', 'null'], maxLength: 5000 }
  };
};

// A dialog Feature. `required` differs between a new dialog (no id yet) and a stored one.
const dialogFeature = (description, required, propertiesSchema) => ({
  type: 'object',
  description,
  required,
  properties: {
    type: { const: 'Feature' },
    id: ref('DialogId'),
    geometry: {
      description: 'Var dialogen har genomförts. Null om den saknar plats.',
      oneOf: [ref('Geometry'), { type: 'null' }]
    },
    properties: ref(propertiesSchema)
  }
});

const errorResponse = (summary, description) => ({
  summary,
  description,
  content: { 'application/json': { schema: ref('Error') } }
});

module.exports = {
  openapi: '3.2.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'Dialogkarta API',
    summary: 'Medborgardialoger i kartan: var de har genomförts och vad de gav.',
    description: 'REST-API för Origo-pluginet Dialogkarta. En dialog är en GeoJSON-Feature. '
      + 'Läsning är öppen; allt som ändrar data kräver behörighet enligt värdapplikationen.',
    version: '1.0.0',
    contact: { name: 'Sundsvalls kommun' },
    license: { name: 'MIT', identifier: 'MIT' }
  },
  // Filled in from the mount point when the document is served, see router.js.
  servers: [{ url: '/api/v1/dialogs', description: 'Fristående server (server/index.js)' }],
  tags: [
    {
      name: 'dialogs', summary: 'Dialoger', description: 'Skapa, läsa, ändra, arkivera och ta bort dialoger.', kind: 'nav'
    },
    {
      name: 'attachments', summary: 'Bilagor', description: 'Rapporter, bilder och resultatdata (t.ex. GeoJSON) till en dialog.', parent: 'dialogs', kind: 'nav'
    },
    {
      name: 'meta', summary: 'API-beskrivning', description: 'Det här dokumentet.', kind: 'nav'
    }
  ],
  paths: {
    '/openapi.json': {
      get: {
        tags: ['meta'],
        operationId: 'getOpenApiDocument',
        summary: 'Hämta API-beskrivningen',
        security: [],
        responses: {
          200: {
            summary: 'OpenAPI-dokumentet',
            description: 'Det här dokumentet som JSON.',
            content: { 'application/json': { schema: { type: 'object' } } }
          }
        }
      }
    },
    '/': {
      get: {
        tags: ['dialogs'],
        operationId: 'listDialogs',
        summary: 'Lista alla dialoger',
        security: [],
        responses: {
          200: { summary: 'Dialogerna', description: 'Alla dialoger, även arkiverade.', content: geojson(ref('DialogCollection')) },
          500: response('ServerError')
        }
      },
      post: {
        tags: ['dialogs'],
        operationId: 'createDialog',
        summary: 'Skapa en dialog',
        description: 'Utan `id` skapar servern ett. Egenskaper som servern hanterar (`readOnly`) ignoreras.',
        security: writeSecurity,
        requestBody: { $ref: '#/components/requestBodies/NewDialog' },
        responses: {
          201: {
            summary: 'Skapad',
            description: 'Dialogen som den sparades.',
            headers: { Location: { description: 'Adress till den nya dialogen.', schema: { type: 'string' } } },
            content: geojson(ref('Dialog'))
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          503: response('ServiceUnavailable'),
          409: response('Conflict'),
          413: response('PayloadTooLarge'),
          415: response('UnsupportedMediaType'),
          500: response('ServerError')
        }
      }
    },
    '/{id}': {
      parameters: [{ $ref: '#/components/parameters/DialogId' }],
      get: {
        tags: ['dialogs'],
        operationId: 'getDialog',
        summary: 'Hämta en dialog',
        security: [],
        responses: {
          200: { summary: 'Dialogen', description: 'Dialogen.', content: geojson(ref('Dialog')) },
          400: response('BadRequest'),
          404: response('NotFound'),
          500: response('ServerError')
        }
      },
      put: {
        tags: ['dialogs'],
        operationId: 'replaceDialog',
        summary: 'Ändra eller arkivera en dialog',
        description: 'Ersätter dialogen. Arkivera genom att sätta `archived: true`. '
          + 'Bilagor, tidsstämplar och `createdBy` behålls från den sparade dialogen.',
        security: writeSecurity,
        requestBody: { $ref: '#/components/requestBodies/NewDialog' },
        responses: {
          200: { summary: 'Ändrad', description: 'Dialogen som den sparades.', content: geojson(ref('Dialog')) },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          503: response('ServiceUnavailable'),
          404: response('NotFound'),
          413: response('PayloadTooLarge'),
          415: response('UnsupportedMediaType'),
          500: response('ServerError')
        }
      },
      delete: {
        tags: ['dialogs'],
        operationId: 'deleteDialog',
        summary: 'Ta bort en dialog och dess bilagor',
        security: writeSecurity,
        responses: {
          204: { summary: 'Borttagen', description: 'Dialogen och dess bilagor är borttagna.' },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          503: response('ServiceUnavailable'),
          404: response('NotFound'),
          500: response('ServerError')
        }
      }
    },
    '/{id}/attachments': {
      parameters: [{ $ref: '#/components/parameters/DialogId' }],
      post: {
        tags: ['attachments'],
        operationId: 'addAttachment',
        summary: 'Lägg till en bilaga',
        description: 'Filen skickas som rå body med sin egen Content-Type, så att ingen multipart-tolkning behövs.',
        security: writeSecurity,
        parameters: [{ $ref: '#/components/parameters/Filename' }],
        requestBody: {
          required: true,
          description: 'Filens innehåll.',
          content: { '*/*': { schema: { contentMediaType: 'application/octet-stream' } } }
        },
        responses: {
          201: { summary: 'Uppladdad', description: 'Bilagan.', content: { 'application/json': { schema: ref('Attachment') } } },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          503: response('ServiceUnavailable'),
          404: response('NotFound'),
          413: response('PayloadTooLarge'),
          500: response('ServerError')
        }
      }
    },
    '/{id}/attachments/{attachmentId}': {
      parameters: [{ $ref: '#/components/parameters/DialogId' }, { $ref: '#/components/parameters/AttachmentId' }],
      get: {
        tags: ['attachments'],
        operationId: 'getAttachment',
        summary: 'Ladda ner en bilaga',
        security: [],
        responses: {
          200: {
            summary: 'Filen',
            description: 'Filen med den Content-Type den laddades upp med. Skickas alltid som nedladdning.',
            headers: {
              'Content-Disposition': { description: '`attachment` med filnamnet.', schema: { type: 'string' } }
            },
            content: { '*/*': { schema: { contentMediaType: 'application/octet-stream' } } }
          },
          400: response('BadRequest'),
          404: response('NotFound'),
          500: response('ServerError')
        }
      },
      delete: {
        tags: ['attachments'],
        operationId: 'deleteAttachment',
        summary: 'Ta bort en bilaga',
        security: writeSecurity,
        responses: {
          204: { summary: 'Borttagen', description: 'Bilagan är borttagen.' },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          503: response('ServiceUnavailable'),
          404: response('NotFound'),
          500: response('ServerError')
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Token enligt värdapplikationen: API_TOKEN i den fristående servern, '
          + 'en access-token från inloggningen i origoserver.'
      }
    },
    parameters: {
      DialogId: {
        name: 'id', in: 'path', required: true, description: 'Dialogens id.', schema: ref('DialogId')
      },
      AttachmentId: {
        name: 'attachmentId', in: 'path', required: true, description: 'Bilagans id.', schema: ref('DialogId')
      },
      Filename: {
        name: 'X-Filename',
        in: 'header',
        required: false,
        description: 'Filnamnet, URI-kodat (encodeURIComponent). Sökvägar tas bort. Saknas det heter filen "fil".',
        schema: { type: 'string', maxLength: 1000 }
      }
    },
    requestBodies: {
      NewDialog: {
        required: true,
        description: 'Dialogen som GeoJSON-Feature.',
        content: {
          'application/geo+json': { schema: ref('DialogInput') },
          'application/json': { schema: ref('DialogInput') }
        }
      }
    },
    responses: {
      BadRequest: errorResponse('Ogiltigt anrop', 'Anropet följer inte API-beskrivningen; `error` säger vad som är fel.'),
      Unauthorized: {
        ...errorResponse('Inte inloggad', 'Ändringar kräver inloggning.'),
        headers: { 'WWW-Authenticate': { description: 'Hur man loggar in, t.ex. `Bearer`.', schema: { type: 'string' } } }
      },
      Forbidden: errorResponse('Saknar behörighet', 'Användaren får inte ändra dialoger.'),
      NotFound: errorResponse('Finns inte', 'Dialogen eller bilagan finns inte.'),
      Conflict: errorResponse('Finns redan', 'Det finns redan en dialog med det id:t.'),
      PayloadTooLarge: errorResponse('För stort', 'Anropet eller filen är större än serverns gräns.'),
      UnsupportedMediaType: errorResponse('Fel innehållstyp', 'Dialoger skickas som application/geo+json eller application/json.'),
      ServerError: errorResponse('Serverfel', 'Något gick fel på servern.'),
      ServiceUnavailable: errorResponse('Tillfälligt otillgänglig', 'Behörigheten kunde inte kontrolleras just nu, t.ex. för att inloggningstjänsten eller AD inte svarar.')
    },
    schemas: {
      DialogId: { type: 'string', pattern: ID_PATTERN, examples: ['bosvedjan-2025', '3f2c8a4e-8d1b-4c4f-9a57-5d1e8b0c9f21'] },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', description: 'Vad som gick fel.' } }
      },
      Position: position,
      Point: geometry('Point', ref('Position')),
      MultiPoint: geometry('MultiPoint', { type: 'array', items: ref('Position') }),
      LineString: geometry('LineString', { type: 'array', minItems: 2, items: ref('Position') }),
      MultiLineString: geometry('MultiLineString', { type: 'array', items: { type: 'array', minItems: 2, items: ref('Position') } }),
      Polygon: geometry('Polygon', { type: 'array', items: ring }),
      MultiPolygon: geometry('MultiPolygon', { type: 'array', items: { type: 'array', items: ring } }),
      GeometryCollection: {
        type: 'object',
        description: 'Flera ritade delar. Nästlade samlingar tillåts inte (RFC 7946 avråder från dem).',
        required: ['type', 'geometries'],
        properties: {
          type: { const: 'GeometryCollection' },
          geometries: {
            type: 'array',
            items: {
              oneOf: ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].map(ref)
            }
          }
        }
      },
      Geometry: {
        description: 'GeoJSON-geometri (RFC 7946) i kartans lagringsprojektion, i Sundsvall EPSG:3014.',
        oneOf: ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].map(ref)
      },
      DialogProperties: dialogProperties(false),
      DialogPropertiesInput: dialogProperties(true),
      DialogInput: dialogFeature('En dialog att spara. `id` är valfritt när den skapas.', ['type', 'properties'], 'DialogPropertiesInput'),
      Dialog: dialogFeature('En sparad dialog.', ['type', 'id', 'geometry', 'properties'], 'DialogProperties'),
      DialogCollection: {
        type: 'object',
        required: ['type', 'features'],
        properties: {
          type: { const: 'FeatureCollection' },
          features: { type: 'array', items: ref('Dialog') }
        }
      },
      Attachment: {
        type: 'object',
        required: ['id', 'name', 'size'],
        properties: {
          id: ref('DialogId'),
          name: { type: 'string', description: 'Filnamnet.' },
          type: { type: ['string', 'null'], description: 'Content-Type.' },
          size: { type: 'integer', minimum: 0, description: 'Storlek i byte.' },
          createdAt: { type: 'string', format: 'date-time' },
          createdBy: { type: ['string', 'null'] }
        }
      }
    }
  }
};
