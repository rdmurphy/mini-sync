<h1 align="center">
  mini-sync
</h1>
<p align="center">
  <a href="https://www.npmjs.org/package/mini-sync"><img src="https://badgen.net/npm/v/mini-sync" alt="npm"></a>
  <a href="https://github.com/rdmurphy/mini-sync/actions?query=workflow%3A%22Node.js+CI%22"><img src="https://badgen.net/github/checks/rdmurphy/mini-sync?label=build" alt="build status"></a>
  <a href="https://unpkg.com/mini-sync/client/dist/client.js"><img src="https://badgen.net/badgesize/gzip/https://unpkg.com/mini-sync/client/dist/client.js" alt="gzip size"></a>
  <a href="https://unpkg.com/mini-sync/client/dist/client.js"><img src="https://badgen.net/badgesize/brotli/https://unpkg.com/mini-sync/client/dist/client.js" alt="brotli size"></a>
  <a href="https://packagephobia.now.sh/result?p=mini-sync"><img src="https://badgen.net/packagephobia/install/mini-sync" alt="install size"></a>
</p>

`mini-sync` is an incredibly tiny, live-reloading development server that uses [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) to keep your browser in sync with your front-end code.

## Key features

- 🦗 For less **than a few hundred KBs**, get a fully functional static server that can communicate with browsers during development
- ♻️ Bundles the maintained version of [`livereload-js`](https://github.com/livereload/livereload-js) in the client code to manage the reloading logic
- 📦 Client code may be included in browsers via your preferred bundler, the static server or CDN

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Setup](#setup)
- [Usage](#usage)
  - [Server](#server)
  - [Client](#client)
    - [Load directly in your HTML](#load-directly-in-your-html)
    - [Conditionally add it to your bundle](#conditionally-add-it-to-your-bundle)
- [API](#api)
  - [Table of Contents](#table-of-contents)
  - [CreateReturn](#createreturn)
    - [Properties](#properties)
  - [StartReturn](#startreturn)
    - [Properties](#properties-1)
  - [create](#create)
    - [Parameters](#parameters)
    - [Examples](#examples)
  - [reload](#reload)
    - [Parameters](#parameters-1)
  - [close](#close)
  - [start](#start)
- [Possible future features](#possible-future-features)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Setup

`mini-sync` has two layers - the server code that's responsible for serving static assets and delivering reload requests, and the client code that needs to be present on your page to receive messages from the server.

Install the package with `npm`, `yarn`, or `pnpm`:

```sh
npm install --save-dev mini-sync
# or
yarn add --dev mini-sync
# or
pnpm add --save-dev mini-sync
```

## Usage

You will need to integrate `mini-sync` both into your build pipeline and your JavaScript/HTML.

### Server

Implement `mini-sync` in your build tool by using it as the static server for your assets during development. Once the server is created, it will return a `reload` function that can be called any time you need to communicate with the browser, a `start` function for activating the static server and watching for `reload` calls, and a `close` function for stopping the server.

```js
const chokidar = require('chokidar'); // or your preferred file watcher
const { create } = require('mini-sync');

const dirToWatch = './app';

async function main() {
  const server = create({
    dir: dirToWatch,
    port: 3000,
  });

  const watcher = chokidar.watch('.', { cwd: dirToWatch });

  // every time a file changes, we call the reload command
  watcher.on('change', (path) => {
    server.reload(path);
  });

  // start our dev server
  const { local, network } = await server.start();

  // report out what our URLs are
  console.log(`Local server URL: ${local}`); // http://localhost:3000
  console.log(`Local network URL: ${network}`); // http://127.x.x.x:3000

  // ...some time later
  await server.close();
}

main().catch(console.error);
```

### Client

`mini-sync` has a tiny script that needs to be added to your JavaScript bundles or loaded on your HTML page. How best to go about this will depend on your environment, but there are a few methods to consider.

#### Load directly in your HTML

If you just want to get the code in your page with minimal fuss, you can add it directly to your HTML. Ideally it would run _before_ the rest of your JavaScript does.

As of 0.2.0 the `mini-sync` server hosts its own copy of the client script, and it can be referenced in your HTML.

```html
<script async src="/__mini_sync__/client.js"></script>
```

It's also possible to load it via [unpkg.com](https://unpkg.com/).

```html
<script async src="https://unpkg.com/mini-sync"></script>
```

#### Conditionally add it to your bundle

Most bundlers support conditional includes based on the value of the `NODE_ENV` environment variable, or a similar mechanism. If you can do this in the configuration itself, that's great! But you also could include it directly in your JavaScript itself within an `if` statement.

```js
if (process.env.NODE_ENV === 'development') {
  require('mini-sync/client');
}
```

In this case it will be present in development builds, but in production builds it will be skipped or entirely removed by your minifier.

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

- [CreateReturn](#createreturn)
  - [Properties](#properties)
- [StartReturn](#startreturn)
  - [Properties](#properties-1)
- [create](#create)
  - [Parameters](#parameters)
  - [Examples](#examples)
- [reload](#reload)
  - [Parameters](#parameters-1)
- [close](#close)
- [start](#start)

### CreateReturn

What's returned when the `create` function is called.

Type: [object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

#### Properties

- `close` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** Stops the server if it is running
- `reload` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** When called this function will reload any connected HTML documents, can accept the path to a file to target for reload
- `start` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** When called the server will begin running

### StartReturn

What's returned by the `start` function in a Promise.

Type: [object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

#### Properties

- `local` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The localhost URL for the static site
- `network` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The local networked URL for the static site
- `port` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** The port the server ended up on

### create

Creates a server on the preferred port and begins serving the provided
directories locally.

#### Parameters

- `options` **[object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** (optional, default `{}`)
  - `options.dir` **([string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>)?** The directory or list of directories to serve (optional, default `process.cwd()`)
  - `options.port` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)?** The port to serve on (optional, default `3000`)

#### Examples

```javascript
const { create } = require('mini-sync');

const server = create({ dir: 'app', port: 3000 });

const { local } = await server.start();

console.log(`Now serving at: ${local}`);

// any time a file needs to change, use "reload"
server.reload('app.css');

// reloads the whole page
server.reload();

// close the server
await server.close();
```

Returns **[CreateReturn](#createreturn)**

### reload

Tells all connected clients to reload.

#### Parameters

- `file` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** The file to reload

### close

Returns a promise once the server closes.

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;void>**

### start

Returns a promise once the server starts.

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[StartReturn](#startreturn)>**

## Possible future features

- Automatic injection of the client code into served HTML pages
- The ability to additionally proxy existing servers

## License

MIT
