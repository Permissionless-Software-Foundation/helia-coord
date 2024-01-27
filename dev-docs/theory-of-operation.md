# Theory of Operation

This document provides a high-level overview of the helia-coord library.
Helia-coord is middleware that controls a Helia IPFS node. It is used to form an on-the-fly, self-healing mesh network of other IPFS nodes. It tracks its connection to other nodes on the network with *entities*. The nodes communicate over *[pubsub channels](https://docs.libp2p.io/concepts/pubsub/overview/)*, and state is managed by *interval timers*.

## Entities

There are three main entities tracked by helia-coord:
- *thisNode* - represents the IPFS node controlled by helia-coord.
- *peers* - are other IPFS peers on the network tracked by helia-coord.
- *relays* - are special *peers* that can establish a webRTC [Circuit Relay](https://docs.libp2p.io/concepts/nat/circuit-relay/) connection between nodes that can not talk to one another directly.
- *pubsub* channels - are communication channels that nodes subscribe to in order to communicate.

These entities are all stateless, meaning that that the node starts by knowing nothing about itself or the other peers on the network. The entities are created at run-time. They are created and information is added to them as the node discovers more about itself and the other peers on the network over time.

### thisNode
The *thisNode* entity represents the Helia IPFS node controlled by helia-coord. There is only *one* instance of *thisNode*.

### peers
A peer entity represents other IPFS nodes on the network that are also running the helia-coord library. These are entities that the *thisNode* entity wants to track and maintain connections to.

### relays
Relay entities are peers, but not all peers are relays. Relays are a special peers with a public IP address, and run the [v2 Circuit Relay protocol](https://docs.libp2p.io/concepts/nat/circuit-relay/). *peer* entities that are behind firewalls and can not connect to one another directly, can connect through a *relay*.

## Pubsub Channels

A series of pubsub channels are opened between the IPFS nodes on the network.

### Coordination Channel
The coordination channel is a public, unencrypted channel that each node subscribes to. Every two minutes, a node will broadcast an 'announcement object', which contains information about the node and how to connect to it. This includes:

- The nodes IPFS ID
- Multiaddrs that can be used for other nodes to connect to it directly.
- The nodes public encryption key so that other nodes can send it e2ee messages.
- The nodes BCH and SLP addresses so that other nodes can send it payments and tokens.
- Metadata that describes what services the node offers and what versions it runs.

### CoinJoin Channel
This channel is not fully developed. It's another public, unencrypted channel that will be used for nodes to coordinate a CoinJoin transaction for achieving financial privacy. This channel can be ignored for now.

### This Nodes Private Channel
A pubsub channel is created using the nodes IPFS ID. Other nodes on the network will subscribe to this channel in order to send it encrypted messages. This channel is only used for receiving messages. The node never broadcasts messages on this channel.

The helia-coord library is consumed by higher-level software like [the pay-to-write database (P2WDB)](https://p2wdb.com), and different software comprising [the Cash Stack](https://cashstack.info). Once RPC commands received on this channel are decrypted, they are passed up to the consuming software via the `privateLog` object.

There are some low-level messages that are not passed up to the consuming software. These are ACK (acknowledge) and metric commands. The metrics commands are primarily used to measure and track latency between nodes and Circuit Relays. The helia-coord library will adjust its connection to achieve the lowest latency connections to other nodes on the network.

### Other Nodes Private Channel
When a new node is discovered via its announcement on the *Coordination Channel*, the node will subscribe to that nodes private channel. The node will use this channel to send encrypted RPC commands to other nodes. This channel is only used for broadcasting. It is never used for receiving messages.

## Interval Timers
A series of interval timers are defined in the `lib/controllser/timer-controller.js` file. These timers are periodically triggered in order to maintain the nodes state. They renew broken connections to other nodes, track latency between the node and Circuit Relays that it knows about, and other operations. These time-based function calls are what allow the node to create the mesh network on-the-fly and the self-heal the network as nodes come online or drop off the network.
