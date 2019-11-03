// packages
import { Reloader } from 'livereload-js/src/reloader';
import { Timer } from 'livereload-js/src/timer';

const reloader = new Reloader(window, console, Timer);

const reloadOptions = {
  liveCSS: true,
  liveImg: true,
};

function connect() {
  const source = new EventSource(
    `http://${window.location.hostname}:${window.location.port}/__dev_sync__`
  );

  source.addEventListener('open', () => {
    console.info('[DEV SYNC] Development server has connected.');
  });

  source.addEventListener('error', err => {
    console.error(err);

    if (source.readyState === EventSource.CLOSED) {
      console.info('[DEV SYNC] Trying to reconnect in 5 seconds.');
      setTimeout(connect, 5000);
    }
  });

  source.addEventListener('reload', (/** @type {MessageEvent} */ event) => {
    const data = JSON.parse(event.data);
    const file = data.file || '';
    reloader.reload(file, reloadOptions);
  });
}

connect();
