# helia-coord Specifications

## Overview

helia-coord is a shortening of the word 'coordination'. It is a JavaScript npm library that helps applications using [Helia](https://github.com/ipfs/helia) coordinate with other peers running related applications.

This document contains a high-level, human-readable specification for the four major architectural areas of the helia-coord library:

- Entities
- Use Cases
- Controllers (inputs)
- Adapters (outputs)

This reflects the [Clean Architecture](https://troutsblog.com/blog/clean-architecture) design pattern.

After the helia-coord library is instantiated, it will have properties `useCases`, `controllers`, and `adapters` that have methods corresponding to the descriptions in this document. Apps can exercise the features of the helia-coord library through this object-oriented structure.

## Configuration

When instantiating the helia-coord library, the following configuration inputs can be passed to its constructor via an object with the properties indicated below. Be sure to check out the [examples directory](../examples) for examples on how to instantiate the library with different configurations.

- `ipfs`: (required) An instance of [Helia](https://github.com/ipfs/helia). The Helia IPFS node must be instantiated outside of helia-coord and passed into it when instantiating the library.
- `wallet`: (required) An instance of [minimal-slp-wallet](https://www.npmjs.com/package/minimal-slp-wallet). The wallet must be instantiated outside of helia-coord and passed into it when instantiating the library. It provides BCH address generation and encryption key management.
- `type`: (required) A string with the value of 'browser' or 'node.js', to indicate what type of app is instantiating the library. This will determine the types of Circuit Relays the library can connect to.
- `statusLog`: A function for handling status output strings on the status of helia-coord. This defaults to `console.log` if not specified.
- `privateLog`: A function for handling private messages passed to this node from peer nodes. This defaults to `console.log` if not specified.
- `debugLevel`: An integer from 0-3 controlling the verbosity of log output. `0` = no debug output (default), `1` = status logs, `2` = verbose connection errors, `3` = everything.
- `isCircuitRelay`: A boolean indicating whether this node should act as a Circuit Relay. Defaults to `false`.
- `circuitRelayInfo`: An object with additional info for circuit relay nodes (e.g. `{ ip4, tcpPort, crDomain }`).
- `announceJsonLd`: A custom JSON-LD object for the node's announcement on the coordination channel. Overrides the default.
- `tcpPort`: TCP port number. Used for auto-detecting the node's public multiaddr.
- `apiInfo`: A string (URL or IPFS hash) pointing to API documentation for the service this node provides.

## Entities

Entities make up the core business concepts. If these entities change, they fundamentally change the entire app.

### thisNode

`thisNode` is the IPFS node consuming the helia-coord library. The thisNode Entity creates a representation of the 'self' and maintains the state of the IPFS node, BCH wallet, peers, relays, and pubsub channels that the node is tracking.

## Use Cases

Use cases are verbs or actions that is done _to_ an Entity or _between_ Entities.

### thisNode

The `this-node-use-cases.js` library contains the following Use Cases:

- `createSelf()` - initializes the `thisNode` Entity. It takes the following actions:

  - It retrieves basic information about the IPFS node like the ID and multiaddresses.
  - It generates BCH and SLP addresses (via the wallet) for payments and a public key used for end-to-end encryption (e2ee).
  - It subscribes to its own private pubsub channel for receiving encrypted messages from other peers.
  - It initializes the Schema library for passing standardized messages.

### Peers

The `peer-use-cases.js` library contains the following Use Cases:

- `addSubnetPeer()` - This is an event handler that is triggered when an 'announcement object' is received on the general coordination pubsub channel. That object is passed to `addSubnetPeer()` to be processed. It will analyze the announcement object and add the peer to the array of peers tracked by the thisNode Entity. If the peer is already known, its data will be updated.

- `refreshPeerConnections()` - is periodically called by the Timer Controller. It checks to see if thisNode is still connected to all the subnet peers. It will refresh the connection if they have been disconnected. Circuit Relays are used to connect to other subnet peers, and each known circuit relay will be cycled through until a connection can be established between thisNode and the subnet peer.

- `sendPrivateMessage()` - sends an encrypted message to another peer on the subnet via their private pubsub channel.

### Relays

The `relay-use-cases.js` library controls the interactions between thisNode and the Circuit Relays that it knows about.

- `getCRGist()` - At startup, helia-coord downloads a list of Circuit Relay nodes from a GitHub Gist (via the Gist adapter). It then attempts to connect to each relay in the list. This is what 'bootstraps' thisNode to the IPFS sub-network and allows it to find subnetwork peers. After that initial bootstrap connection, thisNode will automatically learn about and connect to other peers and circuit relays.

- `connectToBootstrapRelays()` - Connects to the bootstrap peers configured in the libp2p setup. These are peers that are known to run as v2 Circuit Relays and can facilitate connections between other peers.

- `connectToCRs()` - This method is called periodically by the Timer Controller. It checks the connection between thisNode and each Circuit Relay node. If thisNode has lost its connection, the connection is restored.

### Pubsub

The `pubsub-use-cases.js` has a single method:

- `initializePubsub()` is called at startup to connect the node to the general coordination pubsub channel. This is the channel where other apps running the helia-coord library announce themselves to other peers in the subnet.

## Controllers

Controllers are inputs to the system. When a controller is activated, it causes the system to react in some way.

### Timers

The controllers listed in this section are activated periodically by a timer. They do routine maintenance.

- `startTimers()` is called at startup. It initializes the other timer controllers.

- `manageCircuitRelays()` calls the `connectToCRs()` Use Case to refresh connections to other circuit relays.

- `manageAnnouncement()` periodically announces the presence of thisNode Entity on the general coordination pubsub channel. It allows other subnet peers to find the node.

- `managePeers()` checks the list of known subnet peers tracked by thisNode Entity. It will restore the connection to each peer if they get disconnected.

- `getWebRtcMultiaddr()` extracts any webRTC multiaddrs from the node's list of multiaddrs and adds them to the announcement object.

## Adapters

Adapters are the 'outputs' of the system. They are the interfaces that this library manipulates in order to maintain the state of the Entities. Adapters ensure that the business logic doesn't need to know any specific information about the outputs.

### bch-adapter.js

The BCH adapter uses [minimal-slp-wallet](https://www.npmjs.com/package/minimal-slp-wallet) (via its embedded bch-js library) to handle payments and end-to-end encryption in peer communication. When the IPFS node is started, it generates a BCH address to receive payments in BCH, and an SLP address to receive payments in SLP tokens. The same private key used to generate these addresses is used to decrypt incoming pubsub messages, and the public key is passed on to other peers so that they can encrypt messages they want to send thisNode.

### ipfs-adapter.js

This library is designed primarily to control an IPFS node. However, it does not load IPFS directly. It expects the developer to inject an instance of Helia when instantiating this library. It uses the Helia node's underlying libp2p layer for peer management, including connecting, disconnecting, and listing peers.

### encryption-adapter.js

The encryption adapter is responsible for encryption and decryption of pubsub messages. It uses the same Elliptic Curve cryptography used by the Bitcoin protocol. The same private key that is used to generate the BCH address assigned to thisNode is the same private key used to decrypt incoming messages.

Other subnet peers that thisNode tracks will pass on their public key. All messages sent between nodes are encrypted with the receiver's public key. Any unencrypted messages are ignored.

### pubsub-adapter.js

The pubsub adapter can publish a message to a pubsub channel, and route incoming messages to an appropriate handler. There are (public) coordination channels that many peers subscribe to, and messages are published unencrypted. Private messages between peers are sent as encrypted payloads published to the recipient's private pubsub channel.

### gist.js

The Gist adapter interfaces with the GitHub Gist API and the PSF bootstrap server. It is used to download a maintained list of Circuit Relays operated by members of the PSF, providing an up-to-date set of relay nodes that the library can connect to at startup.

### schema.js

The schema library contains formatted JSON objects that are used to generate standardized messages for communication between peers. The schema.js library is instantiated at startup and appended to the thisNode Entity.
