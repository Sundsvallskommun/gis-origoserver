// requireAdGroupMember med en eller flera AD-grupper. Config, token och AD byts ut, så testet
// behöver varken inloggningstjänst eller AD.
//   npm run test:auth
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const handlers = path.resolve(__dirname, '../..');

// Ersätter en modul innan requireAdGroupMember laddar den.
function stub(file, exports) {
  const filename = require.resolve(file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

// Medlemmar per grupp. En grupp som saknas här ger fel från "AD"; finns den i cached
// används den gamla listan.
let groups;
let cached;
const fetched = [];

stub(path.join(handlers, '../conf/config'), {
  auth: {},
  reportIssues: { ad_group: 'Handlaggare' },
});
// "Bearer <namn>" är inloggad som <namn>, utan token är man inte inloggad.
stub(path.join(handlers, 'auth/bearer'), {
  userFromRequest: async (req) => {
    const user = (req.headers.authorization || '').replace(/^Bearer /, '');
    return user ? { sub: user } : null;
  },
});
stub(path.join(handlers, 'openapi/reportIssuesAd'), {
  getAssignees: async (group) => {
    fetched.push(group);
    if (!groups[group]) throw new Error(`AD svarar inte för ${group}`);
    return groups[group].map((username) => ({ username }));
  },
  cachedAssignees: (group) => (cached[group] ? cached[group].map((username) => ({ username })) : null),
});

const requireAdGroupMember = require('../requireAdGroupMember');

beforeEach(() => {
  groups = {
    Handlaggare: ['hanna'],
    Planerare: ['anna'],
    Kultur: ['Bo'],
  };
  cached = {};
  fetched.length = 0;
});

// Kör middlewaren och returnerar { status, body, user } (status 'next' om den släpper igenom).
async function run(middleware, user) {
  const req = { headers: user ? { authorization: `Bearer ${user}` } : {} };
  const result = {};
  const res = {
    set() { return res; },
    status(code) { result.status = code; return res; },
    json(body) { result.body = body; return res; },
  };
  await middleware(req, res, () => { result.status = 'next'; result.user = req.user; });
  return result;
}

const quiet = (fn) => async () => {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  try { await fn(); } finally { console.warn = warn; console.error = error; }
};

test('one group as before', quiet(async () => {
  const mw = requireAdGroupMember({ name: 't', adGroup: 'Planerare' });
  assert.equal((await run(mw, 'anna')).status, 'next');
  assert.equal((await run(mw, 'bo')).status, 403);
  assert.equal((await run(mw)).status, 401);
}));

test('defaults to the group in reportIssues', quiet(async () => {
  const mw = requireAdGroupMember({ name: 't' });
  assert.equal((await run(mw, 'hanna')).status, 'next');
  assert.equal((await run(mw, 'anna')).status, 403);
  assert.deepEqual(fetched, ['Handlaggare', 'Handlaggare']);
}));

test('a list lets in members of any group, ignoring case', quiet(async () => {
  const mw = requireAdGroupMember({ name: 't', adGroup: ['Planerare', 'Kultur'] });
  const anna = await run(mw, 'anna');
  assert.equal(anna.status, 'next');
  assert.equal(anna.user.username, 'anna');
  assert.equal((await run(mw, 'BO')).status, 'next');
  assert.equal((await run(mw, 'hanna')).status, 403);
}));

test('an empty list falls back to the group in reportIssues', quiet(async () => {
  const mw = requireAdGroupMember({ name: 't', adGroup: [] });
  assert.equal((await run(mw, 'hanna')).status, 'next');
}));

test('a group AD cannot fetch does not stop members of the others', quiet(async () => {
  delete groups.Kultur;
  const mw = requireAdGroupMember({ name: 't', adGroup: ['Planerare', 'Kultur'] });
  assert.equal((await run(mw, 'anna')).status, 'next');
}));

test('a group AD cannot fetch gives 503 for others, not 403', quiet(async () => {
  delete groups.Kultur;
  const mw = requireAdGroupMember({ name: 't', adGroup: ['Planerare', 'Kultur'] });
  const res = await run(mw, 'bo');
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'Kunde inte kontrollera behörighet');
}));

test('the last fetched list is used when AD does not answer', quiet(async () => {
  delete groups.Kultur;
  cached.Kultur = ['bo'];
  const mw = requireAdGroupMember({ name: 't', adGroup: ['Planerare', 'Kultur'] });
  assert.equal((await run(mw, 'bo')).status, 'next');
  assert.equal((await run(mw, 'hanna')).status, 403);
}));

test('the user can come from somewhere else than the token, e.g. the session', quiet(async () => {
  const mw = requireAdGroupMember({ name: 't', adGroup: 'Planerare', getUserinfo: async (req) => req.session?.userinfo || null });
  const withSession = (userinfo) => {
    const result = {};
    const res = {
      set() { return res; },
      status(code) { result.status = code; return res; },
      json(body) { result.body = body; return res; },
    };
    return mw({ headers: { authorization: 'Bearer hanna' }, session: userinfo ? { userinfo } : undefined }, res, () => { result.status = 'next'; })
      .then(() => result);
  };
  assert.equal((await withSession({ sub: 'anna' })).status, 'next');
  assert.equal((await withSession({ sub: 'bo' })).status, 403);
  // The token is not used, so without a session the user is not logged in.
  assert.equal((await withSession(null)).status, 401);
}));
