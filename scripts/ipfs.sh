#!/bin/sh

./scripts/hulk.sh

# Bootstrap
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css.map
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://code.jquery.com/jquery-3.3.1.slim.min.js
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js.map
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js.map

# Masonry
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://unpkg.com/masonry-layout@4/dist/masonry.pkgd.min.js

# Hogan.JS
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://twitter.github.io/hogan.js/builds/3.0.1/hogan-3.0.1.js

# Markdown It
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://cdnjs.cloudflare.com/ajax/libs/markdown-it/9.1.0/markdown-it.min.js

# Lazysizes
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://afarkas.github.io/lazysizes/lazysizes.min.js https://afarkas.github.io/lazysizes/plugins/unload/ls.unload.min.js

# Multiaddr
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1  https://unpkg.com/multiaddr/dist/index.min.js

# CID Tool
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1  https://unpkg.com/cid-tool/dist/index.min.js

# Screenlog
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://unpkg.com/screenlog/dist/screenlog.min.js

#Lz-string
ipfs --api=/dns4/ipfs/tcp/5001 add --wrap-with-directory --chunker=rabin --cid-version=1 https://unpkg.com/libs/lz-string.min.js

# IPFS Masonry
ipfs --api=/dns4/ipfs/tcp/5001 add --recursive --wrap-with-directory --chunker=rabin --cid-version=1 css images js json templates index.html robots.txt
