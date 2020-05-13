# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2020-05-13

### Added

- `mini-sync` will now try to recover if the provided port is taken (defaults to `3000`) and increment until it successfully finds an open one.

- The `mini-sync` server now serves a copy of the client side script at `__mini_sync__/client.js`. This may be useful if a user wants to include the client side script without having to depend on `unpkg.com`.

### Changed

- The exported `create` function now returns a `reload` function (for setting up reload calls) a `start` function (activates the static server and returns a Promise with the expected `local` and `network` URLs) and a `close` function. This makes it possible to prepare the server and pass around the `reload` function without the server being active until you're ready, and to spin it down manually. Previously it was possible for `mini-sync` to "beat" the rest of your code to being ready, causing cryptic race condition errors.

- An implementation detail, but `mini-sync`'s SSE URL is now `__mini_sync__` instead of `__dev_sync__` - an accidential leftover from a previous iteration of the library.

- The client code now logs `[MINI SYNC]` instead of `[DEV SYNC]` so the source of the client-side logging is clearer.

- A custom logger is now being passed to LiveReload so it won't be so chatty in the console. Instead, `mini-sync` has its own minimal logging of what the `reload` function sent to the client.

### Fixed

- You were technically suppose to be able to not provide any options to `create` but previously it would throw an error. Now passing no options is valid as originally intended.

## [0.1.0] - 2019-11-03

### Added

- Initial release!
