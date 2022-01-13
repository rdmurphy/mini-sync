// native
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

// packages
import access from 'local-access';
import polka from 'polka';
import sirv from 'sirv';

/**
 * Constant for repeated pinging.
 *
 * @private
 * @type {string}
 */
const ping = ':ping\n';

/**
 * A helper for sending SSE messages.
 *
 * @private
 * @param {string[]} messages A list of messages to send
 * @return {string}
 */
function writeMessage(messages) {
  return messages.join('\n') + '\n\n';
}

/**
 * Constant for reused Cache-Control header.
 *
 * @private
 * @type {string}
 */
const doNotCache = 'no-cache, no-store, must-revalidate';

/**
 * The contents of the compiled client-side code as a Buffer.
 * @private
 * @type {Buffer}
 */
const clientScript = readFileSync(
  new URL('client/dist/client.js', import.meta.url)
);

/**
 * The favicon.ico as a Buffer.
 * @private
 * @type {Buffer}
 */
const favicon = readFileSync(new URL('assets/favicon.ico', import.meta.url));

/**
 * What's returned when the `create` function is called.
 *
 * @typedef {object} CreateReturn
 * @property {Function} close Stops the server if it is running
 * @property {Function} reload When called this function will reload any connected HTML documents, can accept the path to a file to target for reload
 * @property {Function} start When called the server will begin running
 */

/**
 * What's returned by the `start` function in a Promise.
 *
 * @typedef {object} StartReturn
 * @property {string} local The localhost URL for the static site
 * @property {string} network The local networked URL for the static site
 * @property {number} port The port the server ended up on
 */

/**
 * Creates a server on the preferred port and begins serving the provided
 * directories locally.
 *
 * @param {object} options
 * @param {string|string[]} [options.dir] The directory or list of directories to serve
 * @param {number} [options.port] The port to serve on
 * @return {CreateReturn}
 * @example
 * const { create } = require('mini-sync');
 *
 * const server = create({ dir: 'app', port: 3000 });
 *
 * const { local } = await server.start();
 *
 * console.log(`Now serving at: ${local}`);
 *
 * // any time a file needs to change, use "reload"
 * server.reload('app.css');
 *
 * // reloads the whole page
 * server.reload();
 *
 * // close the server
 * await server.close();
 *
 */
export function create({ dir = process.cwd(), port = 3000 } = {}) {
  // create a raw instance of http.Server so we can hook into it
  const server = createServer();

  // a Set to track all the current client connections
  const clients = new Set();

  // create our polka server
  const app = polka({ server });

  // make sure "serve" is an array
  const toWatch = Array.isArray(dir) ? dir : [dir];

  // add each directory in "serve"
  for (let idx = 0; idx < toWatch.length; idx++) {
    const directory = toWatch[idx];

    app.use(sirv(directory, { dev: true }));
  }

  app.get('/__mini_sync__', (req, res) => {
    //send headers for event-stream connection
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': doNotCache,
      'Connection': 'keep-alive',
    });

    // send initial ping with retry command
    res.write('retry: 10000\n');

    // add client to Set
    clients.add(res);

    function disconnect() {
      // close the response
      res.end();

      // remove client from our Set
      clients.delete(res);
    }

    req.on('error', disconnect);
    res.on('error', disconnect);
    res.on('close', disconnect);
    res.on('finish', disconnect);
  });

  app.get('__mini_sync__/client.js', (_, res) => {
    // send headers for shipping down a JS file
    res.writeHead(200, {
      'Cache-Control': doNotCache,
      'Content-Length': clientScript.byteLength,
      'Content-Type': 'text/javascript',
    });

    // send the client-side script Buffer
    res.end(clientScript);
  });

  app.get('/favicon.ico', (_, res) => {
    // send headers for shipping down favicon
    res.writeHead(200, {
      'Cache-Control': doNotCache,
      'Content-Length': favicon.byteLength,
      'Content-Type': 'image/vnd.microsoft.icon',
    });

    res.end(favicon);
  });

  /**
   * Tells all connected clients to reload.
   *
   * @param {string} [file] The file to reload
   */
  function reload(file) {
    for (const client of clients) {
      client.write(
        writeMessage(['event: reload', `data: ${JSON.stringify({ file })}`])
      );
    }
  }

  function sendPing() {
    for (const client of clients) {
      client.write(ping);
    }
  }

  /**
   * Returns a promise once the server closes.
   *
   * @returns {Promise<void>}
   */
  function close() {
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);

        resolve();
      });
    });
  }

  /**
   * Returns a promise once the server starts.
   *
   * @returns {Promise<StartReturn>}
   */
  function start() {
    return new Promise((resolve, reject) => {
      server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          setTimeout(() => {
            server.close();
            server.listen(++port);
          }, 100);
        } else {
          reject(e);
        }
      });

      let interval;

      server.on('listening', () => {
        // ping every 10 seconds
        interval = setInterval(sendPing, 10e3);

        // get paths to networks
        const { local, network } = access({ port });

        resolve({ local, network, port });
      });

      server.on('close', () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      });

      app.listen(port);
    });
  }

  return { close, reload, start };
}
