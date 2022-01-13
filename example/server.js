import { fileURLToPath } from 'node:url';
import { create } from '../server.js';

async function main() {
  // create the dev server
  const server = create({
    dir: fileURLToPath(new URL('src', import.meta.url)),
  });

  // start the dev server
  const { local, network } = await server.start();

  // report out what our URLs are
  console.log(`Local server URL: ${local}`);
  console.log(`Local network URL: ${network}`);

  setTimeout(() => server.reload(), 10e3);
}

main().catch(console.error);
