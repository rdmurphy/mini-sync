const { resolve } = require('path');
const { create } = require('../');

async function main() {
  // create the dev server
  const server = create({ dir: resolve(__dirname, 'src') });

  // start the dev server
  const { local, network } = await server.start();

  // report out what our URLs are
  console.log(`Local server URL: ${local}`);
  console.log(`Local network URL: ${network}`);

  setTimeout(() => server.reload(), 10e3);
}

main().catch(console.error);
