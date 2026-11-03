// Keeps the dialogs in one JSON file and the attachments as files next to it. Enough for a
// handful of editors; use the PostgreSQL store when the data should live in the database.

const fs = require('node:fs/promises');
const path = require('node:path');

function createFileStore({ dir }) {
  const file = path.join(dir, 'dialogs.json');
  const attachmentDir = (id) => path.join(dir, 'attachments', id);
  let queue = Promise.resolve();

  // Writes run one at a time, so two saves at once can't overwrite each other.
  function exclusive(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  }

  async function readAll() {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async function writeAll(features) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(features, null, 1));
    await fs.rename(tmp, file);
  }

  const now = () => new Date().toISOString();

  return {
    async list() {
      return readAll();
    },

    async get(id) {
      return (await readAll()).find((f) => f.id === id) || null;
    },

    create: (feature) => exclusive(async () => {
      const all = await readAll();
      const timestamp = now();
      const saved = {
        ...feature,
        properties: {
          ...feature.properties, attachments: [], createdAt: timestamp, updatedAt: timestamp
        }
      };
      all.push(saved);
      await writeAll(all);
      return saved;
    }),

    update: (feature) => exclusive(async () => {
      const all = await readAll();
      const index = all.findIndex((f) => f.id === feature.id);
      if (index === -1) return null;
      const old = all[index].properties;
      const saved = {
        ...feature,
        properties: {
          ...feature.properties,
          archivedAt: feature.properties.archived ? (old.archivedAt || feature.properties.archivedAt || now()) : null,
          attachments: old.attachments || [],
          createdAt: old.createdAt,
          updatedAt: now()
        }
      };
      all[index] = saved;
      await writeAll(all);
      return saved;
    }),

    remove: (id) => exclusive(async () => {
      const all = await readAll();
      const rest = all.filter((f) => f.id !== id);
      if (rest.length === all.length) return false;
      await writeAll(rest);
      await fs.rm(attachmentDir(id), { recursive: true, force: true });
      return true;
    }),

    addAttachment: (id, attachment, data) => exclusive(async () => {
      const all = await readAll();
      const feature = all.find((f) => f.id === id);
      if (!feature) return null;
      await fs.mkdir(attachmentDir(id), { recursive: true });
      await fs.writeFile(path.join(attachmentDir(id), attachment.id), data);
      feature.properties.attachments = [...(feature.properties.attachments || []), attachment];
      await writeAll(all);
      return attachment;
    }),

    async getAttachment(id, attId) {
      const feature = await this.get(id);
      const attachment = feature?.properties.attachments?.find((a) => a.id === attId);
      if (!attachment) return null;
      return { attachment, data: await fs.readFile(path.join(attachmentDir(id), attId)) };
    },

    removeAttachment: (id, attId) => exclusive(async () => {
      const all = await readAll();
      const feature = all.find((f) => f.id === id);
      const attachments = feature?.properties.attachments || [];
      if (!attachments.some((a) => a.id === attId)) return false;
      feature.properties.attachments = attachments.filter((a) => a.id !== attId);
      await writeAll(all);
      await fs.rm(path.join(attachmentDir(id), attId), { force: true });
      return true;
    })
  };
}

module.exports = { createFileStore };
