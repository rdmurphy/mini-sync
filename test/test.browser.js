// native
import { strict as assert } from 'node:assert';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// packages
import { chromium, webkit, firefox } from 'playwright';
import { suite } from 'uvu';

// library
import { create } from '../server.js';

const browserName = process.env.BROWSER || 'chromium';

const it = suite('browser tests');

let browser;
let page;
let server;
let url;
let eventSourceUrl;
let clientUrl;

it.before(async function () {
  server = create({
    dir: fileURLToPath(new URL('fixtures/basic', import.meta.url)),
  });
  const { local } = await server.start();

  url = local;
  eventSourceUrl = `${url}/__mini_sync__`;
  clientUrl = `${eventSourceUrl}/client.js`;

  browser = await { chromium, webkit, firefox }[browserName].launch();
  page = await browser.newPage();
});

it.after(async () => {
  await page.close();
  await browser.close();
  await server.close();
});

it('should load client script and connect using EventSource', async () => {
  // prep to track our responses
  const responses = new Set();

  page.on('response', (res) => {
    responses.add(res.url());
  });

  // load the page
  await page.goto(url);

  // wait for our event source to connect
  await page.waitForResponse(eventSourceUrl);

  // assert we loaded everything we expected
  assert.ok(responses.has(clientUrl));
  assert.ok(responses.has(eventSourceUrl));
});

it('should do a hard reload', async () => {
  // load the page
  await page.goto(url);

  // wait for our event source to connect
  await page.waitForResponse(eventSourceUrl);

  // fire the reload
  server.reload();

  // wait for the refresh
  const response = await page.waitForNavigation();

  // check it out
  assert.ok(response.ok());
  assert.equal(response.url(), `${url}/`);
});

it('should do an inline reload with CSS', async function () {
  // we need a new page
  const localPage = await browser.newPage();

  // create a temp dir
  const stylesDir = await fs.mkdtemp(join(tmpdir(), 'styles'));

  // prep the path to the styles
  const stylesPath = join(stylesDir, 'styles.css');

  // write out the css file
  await fs.writeFile(stylesPath, 'h1 { color: rgb(255, 0, 0); }');

  // create a new server to see the temp directory
  const localServer = create({
    dir: [
      fileURLToPath(new URL('fixtures/styled', import.meta.url)),
      stylesDir,
    ],
  });

  // start the server
  const { local } = await localServer.start();

  // get to the page
  await localPage.goto(local);

  // wait for the element to be available
  const el = await localPage.waitForSelector('h1');

  // get the initial color
  const startingColor = await localPage.evaluate(
    (el) => getComputedStyle(el).color,
    el
  );

  // confirm it matches
  assert.equal(startingColor, 'rgb(255, 0, 0)');

  // let's change the color
  await fs.writeFile(stylesPath, 'h1 { color: rgb(0, 0, 255); }');

  // tell the server to update
  localServer.reload('styles.css');

  // wait for our new styles to be requested and loaded
  const request = await localPage.waitForRequest(
    `${local}/styles.css?livereload=*`
  );
  await localPage.waitForResponse(request.url());

  // get the new color
  const endingColor = await localPage.evaluate(
    (el) => getComputedStyle(el).color,
    el
  );

  // confirm it changed
  assert.equal(endingColor, 'rgb(0, 0, 255)');

  // close the localPage
  await localPage.close();

  // close the local server
  await localServer.close();
});

it.run();
