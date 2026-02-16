# helia-coord

A JavaScript npm library built on top of [Helia](https://github.com/ipfs/helia), the JS implementation of IPFS. It provides the following high-level features:

- **Subnets** - Helps IPFS nodes create an on-the-fly subnetwork, using pubsub channels.
- **Peer Discovery** - Allows new peers entering the subnetwork to find the other subnetwork peers.
- **E2EE** - Creates end-to-end encrypted (e2ee) communication channels between peers.
- **Censorship Resistance** - Allows automatic networking between peers, even if they are behind a firewall.
- **Payments** - Allows peers to easily pay one another in cryptocurrency for access to web services.

This library helps IPFS peers discover one another, coordinate around a common interest, and then stay connected around that interest. Its main sub-components are:

- [libp2p](https://libp2p.io/) pubsub channels (via [gossipsub](https://github.com/ChainSafe/js-libp2p-gossipsub)) for communication
- [Circuit Relays](https://docs.libp2p.io/concepts/nat/circuit-relay/) for censorship resistance and tunneling through firewalls
- [Bitcoin Cash](https://bitcoincash.org/) for end-to-end encryption and payments

helia-coord will automatically track peers, connect to them through circuit relays, and end-to-end encrypt all communication with each node. Interval timers continually maintain these connections, creating a self-healing mesh network. For more details, read the [dev-docs](./dev-docs).

Here are some use cases where IPFS node coordination is needed:

- e2e encrypted chat
- Circuit-relay as-a-service
- Creating CoinJoin transactions
- Decentralized exchange of currencies
- Compute-as-a-service
- Storage-as-a-service

The ultimate goal of this library is to be a building block for replacing conventional REST APIs. An IPFS-based API, in a fully distributed network like IPFS, must have sophisticated coordination in order to function properly. helia-coord is that coordination library. It is consumed by higher-level applications like [ipfs-service-provider](https://github.com/Permissionless-Software-Foundation/ipfs-service-provider).

## Install

Install the npm library:

```bash
npm install --save helia-coord
```

This library requires a peer dependency of [minimal-slp-wallet](https://www.npmjs.com/package/minimal-slp-wallet).

## Quick Start

helia-coord exports two things:

- **`IpfsCoord`** (default export) - The coordination library that wraps a Helia IPFS node.
- **`CreateHeliaNode`** (via `helia-coord/create-helia-node`) - A factory class for creating a properly configured Helia IPFS node.

### Example in a node.js app

Here is an example of adding helia-coord to your own node.js app:

```javascript
import SlpWallet from 'minimal-slp-wallet'
import IpfsCoord from 'helia-coord'
import CreateHeliaNode from 'helia-coord/create-helia-node'

async function start () {
  // Create an instance of the BCH wallet.
  const wallet = new SlpWallet()
  await wallet.walletInfoPromise

  // Create a Helia IPFS node.
  const createHeliaNode = new CreateHeliaNode()
  const ipfs = await createHeliaNode.start()

  // Pass the wallet and IPFS node to helia-coord when instantiating it.
  const ipfsCoord = new IpfsCoord({
    ipfs,
    wallet,
    type: 'node.js',
    debugLevel: 1
  })

  await ipfsCoord.start()
  console.log('IPFS and the coordination library is ready.')
}
start()
```

See [`examples/start-node.js`](./examples/start-node.js) for a working example.

## Configuration

When instantiating `IpfsCoord`, the following configuration properties can be passed to its constructor:

| Property | Required | Description |
|---|---|---|
| `ipfs` | Yes | An instance of a [Helia](https://github.com/ipfs/helia) IPFS node. |
| `wallet` | Yes | An instance of [minimal-slp-wallet](https://www.npmjs.com/package/minimal-slp-wallet). Used for BCH payments and generating encryption keys. |
| `type` | Yes | `'node.js'` or `'browser'` - the type of environment the app is running in. |
| `debugLevel` | No | Integer from 0-3. `0` = no debug output (default), `1` = status logs, `2` = verbose connection errors, `3` = everything. |
| `statusLog` | No | A function for handling status log messages. Defaults to `console.log`. |
| `privateLog` | No | A function for handling incoming e2e encrypted private messages from other peers. Defaults to `console.log`. |
| `nodeType` | No | `'embedded'` (default) or `'external'`. |
| `isCircuitRelay` | No | Boolean. Set to `true` if this node should act as a Circuit Relay. Defaults to `false`. |
| `circuitRelayInfo` | No | Object with additional info for circuit relay nodes (e.g. `{ ip4, tcpPort, crDomain }`). |
| `announceJsonLd` | No | A custom [JSON-LD](https://json-ld.org/) object for the node's announcement. Overrides the default. |
| `tcpPort` | No | TCP port number. Used for auto-detecting the node's public multiaddr. |
| `apiInfo` | No | A string (URL or IPFS hash) pointing to API documentation for the service this node provides. |

When instantiating `CreateHeliaNode`, the following configuration properties can be passed:

| Property | Default | Description |
|---|---|---|
| `ipfsDir` | `'./.ipfsdata/ipfs'` | Directory for IPFS block and data stores. |
| `tcpPort` | `4001` | TCP port for libp2p to listen on. |
| `wsPort` | `4003` | WebSocket port for libp2p to listen on. |
| `isCircuitRelay` | `false` | Whether to enable the circuit relay server. |
| `bootstrapPeers` | PSF defaults | Array of multiaddr strings for bootstrap peer discovery. |
| `getSeed` | Random | An async function returning a seed string for the libp2p keychain. Provide this to get a persistent IPFS peer ID across restarts. |

## Development Environment

Clone the repository and install dependencies:

```bash
git clone https://github.com/Permissionless-Software-Foundation/helia-coord
cd helia-coord
npm install
```

### Running Tests

This project uses [Mocha](https://mochajs.org/) for testing, [Chai](https://www.chaijs.com/) for assertions, [Sinon](https://sinonjs.org/) for mocks, and [nyc](https://github.com/istanbuljs/nyc) for code coverage.

Run the unit test suite:

```bash
npm test
```

This runs the linter ([Standard.js](https://standardjs.com/)) followed by the unit tests.

Generate a coverage report:

```bash
npm run coverage:report
```

### Running the Example App

The `examples/` directory contains a working example that starts a Helia IPFS node with helia-coord attached:

```bash
cd examples
node start-node.js
```

This will create a Helia IPFS node, connect to the PSF coordination network, discover peers, and begin announcing itself on the pubsub coordination channel. IPFS data is stored in `examples/.ipfsdata/`.

## Architecture

helia-coord follows the [Clean Architecture](https://troutsblog.com/blog/clean-architecture) design pattern, organized into four layers:

- **Entities** - Core business objects: `thisNode` (the local IPFS node), `peers` (other nodes on the subnet), `relays` (circuit relay nodes), and `pubsub` channels.
- **Use Cases** - Actions performed on entities: creating the node identity, managing peer connections, handling relay connections, and initializing pubsub.
- **Controllers** - Inputs to the system, primarily interval timers that periodically maintain connections, announce the node, and manage peer/relay state.
- **Adapters** - Interfaces to external systems: IPFS (Helia/libp2p), BCH (minimal-slp-wallet), encryption (Elliptic Curve), pubsub messaging, and a GitHub Gist adapter for discovering circuit relays.

After instantiation, the library exposes `useCases`, `controllers`, and `adapters` properties for programmatic access to its features.

## Further Reading

- [dev-docs/theory-of-operation.md](./dev-docs/theory-of-operation.md) - High-level overview of entities, pubsub channels, and interval timers.
- [dev-docs/usage-and-code.md](./dev-docs/usage-and-code.md) - Detailed specifications for the Clean Architecture layers.
- [Helia](https://github.com/ipfs/helia) - The JavaScript IPFS implementation that helia-coord wraps.
- [ipfs-service-provider](https://github.com/Permissionless-Software-Foundation/ipfs-service-provider) - A higher-level application that consumes helia-coord.
- [The Cash Stack](https://cashstack.info) - The full software stack that helia-coord is a part of.
- [PSFoundation.cash](https://PSFoundation.cash) - The Permissionless Software Foundation.

## License

[MIT](LICENSE.md)
