export function migrate (cache) {
  if (cache.cacheVersion === '0.1.0') {
    if (cache.folders) {
      console.info(`Folders size before ${cache.folders.length}`)
      cache.folders = LZString.compress(cache.folders)
      console.info(`Folders size after ${cache.folders.length}`)
    }

    if (cache.files) {
      console.info(`Files size before ${cache.files.length}`)
      cache.files = LZString.compress(localScachetorage.files)
      console.info(`Files size after ${cache.files.length}`)
    }
    cache.cacheVersion = '0.2.0'
  }
}
