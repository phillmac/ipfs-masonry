#!/bin/sh
ipfs add --recursive --wrap-with-directory --chunker=rabin --cid-version=1 css images js json templates index.html robots.txt
