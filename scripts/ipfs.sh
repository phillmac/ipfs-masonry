#!/bin/sh

./scripts/hulk.sh

# IPFS Masonry
ipfs --api=/dns4/ipfs/tcp/5001 add --recursive --wrap-with-directory --chunker=rabin --cid-version=1 css images js templates index.html robots.txt
