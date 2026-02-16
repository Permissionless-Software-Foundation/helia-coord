# Startup

Outline of the startup procedure for helia-coord. See [theory-of-operation.md](./theory-of-operation.md) for a high-level overview and [usage-and-code.md](./usage-and-code.md) for details on each architectural layer.

1. The consuming application creates a Helia IPFS node (e.g. via `CreateHeliaNode`) and an instance of `minimal-slp-wallet`.
2. The consuming application instantiates `IpfsCoord`, passing in the Helia node, wallet, and configuration options.
3. The consuming application calls `ipfsCoord.start()`, which triggers the following sequence:
   - The IPFS adapter starts and retrieves the node's peer ID and multiaddrs.
   - `createSelf()` builds the `thisNode` entity by aggregating IPFS info, generating BCH/SLP addresses and a public encryption key from the wallet, initializing the Schema library, and subscribing to the node's own private pubsub channel.
   - `initializePubsub()` subscribes the node to the general coordination pubsub channel.
   - `startTimers()` initializes the interval timers that maintain connections to relays, announce the node, and manage peer connections.
   - `_initializeConnections()` downloads the Circuit Relay list from the GitHub Gist and attempts initial connections to relays and subnet peers. This runs without blocking so it does not delay startup of the consuming application.
