// native
const fs = require('fs');
const http = require('http');
const { join, normalize, resolve } = require('path');

// packages
const access = require('local-access');
const polka = require('polka');
const parse = require('@polka/url');
const sirv = require('sirv');

// package.json
const pkg = require('./package.json');

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
const clientScript = fs.readFileSync(resolve(__dirname, pkg['umd:main']));

/**
 * The favicon.ico as a Buffer.
 * @private
 * @type {Buffer}
 */
const favicon = fs.readFileSync(resolve(__dirname, 'assets/favicon.ico'));

function htmlInjectionMiddleware(dirs) {
  const extensions = ['html', 'htm'];

  function getValue(x) {
    let y = x.indexOf('/', 1);
    return y > 1 ? x.substring(0, y) : x;
  }

  function getPossiblePaths(uri) {
    let i = 0;
    let x;
    let len = uri.length - 1;

    if (uri.charCodeAt(len) === 47) {
      uri = uri.substring(0, len);
    }

    const arr = [];
    let tmp = `${uri}/index`;

    for (; i < extensions.length; i++) {
      x = extensions[i] ? `.${extensions[i]}` : '';
      if (uri) arr.push(uri + x);
      arr.push(tmp + x);
    }

    return arr;
  }

  function queryLocalFile(dir, arr) {
    let i = 0;
    let abs, stats, name, headers;

    for (; i < arr.length; i++) {
      abs = normalize(join(dir, (name = arr[i])));

      if (abs.startsWith(dir) && fs.existsSync(abs)) {
        stats = fs.statSync(abs);
        if (stats.isDirectory()) continue;

        headers = {
          'Content-Type': 'text/html',
          'Last-Modified': stats.mtime.toUTCString(),
          'Cache-Control': 'no-store',
        };

        return { abs, stats, headers };
      }
    }
  }

  return function htmlInjection(req, res, next) {
    const info = parse(req);
    const paths = getPossiblePaths(getValue(info.pathname));

    for (let idx = 0; idx < dirs.length; idx++) {
      const dir = dirs[idx];

      const data = queryLocalFile(dir, paths);

      if (data) {
        const rendered = fs
          .readFileSync(data.abs, 'utf8')
          .replace(
            '</head>',
            '<script async src="/__mini_sync__/client.js"></script>\n</head>'
          );
        data.headers['Content-Length'] = Buffer.byteLength(rendered, 'utf8');
        res.writeHead(200, data.headers);
        res.end(rendered);
      }
    }

    next();
  };
}

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
 * @param {boolean} [options.injectClientScript] If true, inject the client script into served HTML pages
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
function create({
  dir = process.cwd(),
  injectClientScript = true,
  port = 3000,
} = {}) {
  // create a raw instance of http.Server so we can hook into it
  const server = http.createServer();

  // a Set to track all the current client connections
  const clients = new Set();

  // create our polka server
  const app = polka({ server });

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

  // make sure "serve" is an array
  const toWatch = Array.isArray(dir) ? dir : [dir];

  if (injectClientScript) {
    app.use(htmlInjectionMiddleware(toWatch));
  }

  // add each directory in "serve"
  for (let idx = 0; idx < toWatch.length; idx++) {
    const directory = toWatch[idx];

    app.use(sirv(directory, { dev: true }));
  }

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

module.exports = { create };
