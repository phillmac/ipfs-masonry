FROM node:12

COPY . /masonry

RUN  curl https://dist.ipfs.io/go-ipfs/v0.6.0/go-ipfs_v0.6.0_linux-amd64.tar.gz | tar -xz \
 && go-ipfs/install.sh && rm -r go-ipfs

WORKDIR /masonry

CMD ["sh", "-c" " ls -la ./scripts && ./scripts/ipfs.sh"]