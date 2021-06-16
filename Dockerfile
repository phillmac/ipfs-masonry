FROM node:12

RUN curl https://dist.ipfs.io/go-ipfs/v0.6.0/go-ipfs_v0.6.0_linux-amd64.tar.gz | tar -xz \
 && go-ipfs/install.sh && rm -r go-ipfs && npm i -g hogan.js

COPY . /masonry

WORKDIR /masonry

ENV IPFS_PIN="FALSE"

ENTRYPOINT ["./scripts/ipfs.sh"]
