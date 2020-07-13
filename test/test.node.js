// native
const assert = require('assert').strict;
const fs = require('fs').promises;
const http = require('http');
const { join } = require('path');

// packages
const fetch = require('node-fetch').default;
const { suite } = require('uvu');

// library
const { create } = require('../server');

const basic = suite('basic mini-sync serving tests');

let server;
let base;

basic.before(async () => {
  // create the server
  server = create({ dir: join(__dirname, 'fixtures/basic') });

  // start the server
  const { local } = await server.start();
  base = local;
});

basic.after(async () => {
  await server.close();
});

basic('should serve static files', async () => {
  const actual = await fetch(new URL('file.txt', base)).then((res) =>
    res.text()
  );

  assert.equal(actual, 'This is a served file.\n');
});

basic('should be possible to hit the event-stream endpoint', () => {
  const req = http.get(new URL('__mini_sync__', base), (res) => {
    req.abort();

    assert.ok(res.statusCode === 200);
  });
});

basic('should serve the client library', async () => {
  const actual = await fetch(
    new URL('__mini_sync__/client.js', base)
  ).then((res) => res.text());

  const expected = await fs.readFile(
    join(process.cwd(), 'client/dist/client.js'),
    'utf8'
  );

  assert.equal(actual, expected);
});

basic.run();

const options = suite('mini-sync options');

options('should be possible to pass in a different port', async () => {
  const expectedPort = 1234;
  const expectedLocal = `http://localhost:${expectedPort}`;

  const server = create({ port: expectedPort });

  const { local, port } = await server.start();

  assert.equal(port, expectedPort);
  assert.equal(local, expectedLocal);

  await server.close();
});

options(
  'should attempt to find a new port if the provided one is taken',
  async () => {
    const takenPort = 5000;
    const blockingServer = http.createServer().listen(takenPort);

    const server = create({ port: takenPort });

    const { port } = await server.start();

    assert.equal(port, takenPort + 1);

    blockingServer.close();
    await server.close();
  }
);

options.run();
