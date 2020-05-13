// packages
import { Reloader } from 'livereload-js/src/reloader';
import { Timer } from 'livereload-js/src/timer';

const prefix = '[MINI SYNC]';
const reloader = new Reloader(window, { log: () => {} }, Timer);
const reloadOptions = {
  liveCSS: true,
  liveImg: true,
};

function connect() {
  const source = new EventSource(
    `http://${window.location.hostname}:${window.location.port}/__mini_sync__`
  );

  source.addEventListener('open', () => {
    console.info('%s Development server has connected.', prefix);
  });

  source.addEventListener('error', (/** @type {ErrorEvent} */ error) => {
    const readyState = source.readyState;

    const isConnecting = readyState === EventSource.CONNECTING;
    const isClosed = readyState === EventSource.CLOSED;

    if (isConnecting || isClosed) {
      console.info('%s Lost connection. Trying to reconnect...', prefix);

      if (isClosed) {
        source.close();
        setTimeout(connect, 1e4);
      }
    } else {
      console.error(error);
    }
  });

  source.addEventListener('reload', (/** @type {MessageEvent} */ event) => {
    const data = JSON.parse(event.data);
    const file = data.file || '';

    if (file) {
      console.info('%s Reloading "%s".', prefix, file);
    } else {
      console.info('%s Reloading entire page.', prefix);
    }

    reloader.reload(file, reloadOptions);
  });
}

connect();
