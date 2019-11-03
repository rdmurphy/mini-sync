// packages
const access = require('local-access');
const polka = require('polka');
const sirv = require('sirv');

/**
 * Constant for repeated pinging.
 *
 * @private
 * @type {string};
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
 *
 * @typedef {object} CreateReturn
 * @property {string} local The localhost URL for the static site
 * @property {string} network The local networked URL for the static site
 * @property {Function} reload When called this function will reload any connected HTML documents, can accept the path to a file to target for reload
 */

/**
 * Creates a server on the preferred port and begins serving the provided
 * directories locally.
 *
 * @param {object} options
 * @param {string|string[]} options.dir The directory or list of directories to serve
 * @param {number} options.port The port to serve on
 * @return {Promise<CreateReturn>}
 * @example
 * const { create } = require('mini-sync');
 *
 * const { local, reload } = await create({ dir: 'app', port: 3000 });
 *
 * console.log(`Now serving at: ${local}`);
 *
 * // any time a file needs to change, use "reload"
 * reload('app.css');
 *
 * // reloads the whole page
 * reload();
 *
 */
function create({ dir = process.cwd(), port = 3000 }) {
  return new Promise((resolve, reject) => {
    // a set to track all the current client connections
    const clients = new Set();

    // our server
    const app = polka();

    // make sure "serve" is an array
    const toWatch = Array.isArray(dir) ? dir : [dir];

    // add each directory in "serve"
    for (let idx = 0; idx < toWatch.length; idx++) {
      const directory = toWatch[idx];

      app.use(sirv(directory, { dev: true }));
    }

    app.get('/__dev_sync__', (req, res) => {
      //send headers for event-stream connection
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // send initial ping
      res.write(ping);

      // add client to Set
      clients.add(res);

      // if the connection closes, stop tracking this client
      req.on('close', () => {
        // close the response
        res.end();

        // remove client from our Set
        clients.delete(res);
      });
    });

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

    // ping every 10 seconds
    setInterval(sendPing, 1000 * 60);

    app.listen(port, err => {
      if (err) reject(err);

      // get paths to networks
      const { local, network } = access({ port });

      resolve({ local, network, reload });
    });
  });
}

module.exports = { create };
