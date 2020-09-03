FROM node:12

COPY . /masonry

RUN  wget https://dist.ipfs.io/go-ipfs/v0.6.0/go-ipfs_v0.6.0_linux-amd64.tar.gz | tar -xzv \
 && go-ipfs/install.sh && rm -r go-ipfs \
 && cd /masonry && scripts/ipfs.sh