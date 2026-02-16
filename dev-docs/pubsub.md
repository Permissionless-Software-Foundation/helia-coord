# Pubsub

One of the primary functions of the helia-coord library is managing pubsub channels for communication between IPFS nodes. See [theory-of-operation.md](./theory-of-operation.md) for a high-level overview of the channel types.

## Coordination Channel

All nodes on the subnet subscribe to a shared coordination channel (configured in `config/global-config.js` as `DEFAULT_COORDINATION_ROOM`). Nodes periodically broadcast an announcement object on this channel containing their IPFS ID, multiaddrs, public encryption key, BCH/SLP addresses, and JSON-LD metadata. When a node receives an announcement, it is routed to `addSubnetPeer()` in `peer-use-cases.js` to be processed.

## Private Channels

Each node subscribes to a pubsub channel named after its own IPFS peer ID. This channel is used exclusively for **receiving** encrypted messages from other peers. The node never broadcasts on its own private channel.

When a new peer is discovered via the coordination channel, the node subscribes to that peer's private channel in order to **send** encrypted messages to it. Messages are encrypted with the recipient's public key using Elliptic Curve cryptography (via `encryption-adapter.js`) before being published.

Incoming encrypted messages on the private channel are decrypted and then passed up to the consuming application via the `privateLog` callback. Low-level messages such as ACK and metric commands are handled internally by helia-coord and are not passed up.

## Message Routing

The pubsub adapter (`lib/adapters/pubsub-adapter/`) handles message routing:

- `messaging.js` - Publishes messages to pubsub channels.
- `msg-router.js` - Routes incoming messages to the appropriate handler based on the channel and message type.
- `resend-msg.js` - Handles retrying failed message deliveries.

## CoinJoin Channel

A separate pubsub channel (`BCH_COINJOIN_ROOM` in the global config) exists for coordinating CoinJoin transactions for financial privacy. This channel is not fully developed and can be ignored for now.
