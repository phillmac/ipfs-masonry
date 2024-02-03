#!/bin/sh

./scripts/hulk.sh

# IPFS Masonry
if [ "${IPFS_PIN}" = "TRUE" ] || [ "${IPFS_PIN}" = "true" ]
then
    ipfs --api=/dns4/ipfs/tcp/5001 add "${@}" --recursive --wrap-with-directory --chunker=rabin --cid-version=1 --ignore './assets/gallery.png' app assets images templates index.html robots.txt
else
    ipfs --api=/dns4/ipfs/tcp/5001 add "${@}" --recursive --wrap-with-directory --chunker=rabin --cid-version=1 --pin=false --ignore './assets/gallery.png' app assets images templates index.html robots.txt
fi
