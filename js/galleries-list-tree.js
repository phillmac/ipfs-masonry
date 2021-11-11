const itemType = 1

const doFetch = (url, options = {}) => fetch(url, { referrerPolicy: 'no-referrer', ...options })

async function* callApiEndpoints(endPoints) {
  const abort = new AbortController()
  const signal = abort.signal
  yield* endPoints.map(async ep => {
    try {
      const response = await doFetch(ep, { signal })
      if (response.status === 200) {
        const json = await response.json()
        abort.abort()
        return json
      } else {
        return {}
      }
    } catch (err) {
      console.debug(err)
      return {}
    }
  })
}
export const className = 'GalleriesListTree'

export class GalleriesListTree {
  constructor({ params, config, cache }) {
    const folderCacheTTL = config?.cache?.TTL?.folders || 604800
    const galleryFolder = config?.path?.names?.[params.galleryFolderName] || 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs || 'thumbs'

    const basePaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries

    // const listing =

    const listFolder = async function* (folderPath, quick = true) {
      console.log(`Listing folder ${folderPath}`)
      const storageKey = 'folders'
      const cacheTTL = folderCacheTTL
      const localResults = []

      if (cacheDisabled.includes(storageKey)) {
        console.debug(`${storageKey} cache is disabled`)
      } else {
        (await cache.getWithExpiry(storageKey, folderPath) || []).forEach(i => localResults.push(i))
        yield* localResults.filter(l => l.Type === itemType).map(lr => lr.Name)
      }

      if (!(quick && localResults.length > 0)) {
        console.debug(`Slow ${folderPath} quick: ${quick} length: ${localResults.length}`)

        const endPoints = apiHosts.map(api => `${api}/${config.api.path}/ls?arg=${folderPath}`)

        for await (const apiResponse of callApiEndpoints(endPoints)) {
          if (apiResponse.Objects) {
            const object = apiResponse.Objects.find(o => o.Hash === folderPath)
            const localNames = localResults.map(lr => lr.Name)
            const missing = object.Links
              .filter(li => !(localNames.includes(li.Name)))
              .filter(li => li.Type === itemType)
            if (missing.length > 0) {
              await cache.setWithExpiry(storageKey, folderPath, [...localResults, ...missing], cacheTTL)
              yield* missing.map(li => li.Name)
            }
          }
        }
      }
    }

    const hasThumbs = (folderPath) => hasItem(folderPath, thumbsFolder)

    const hasGallery = (folderPath) => hasItem(folderPath, galleryFolder)

    const filterGalleries = async function* (bPath) {

      for await (const folderItem of listFolder(galleryPath)) {
        if (
          await hasGallery(`${bPath}/${folderItem}`, galleryFolder)
        ) {
          if ((await hasThumbs(`${bPath}/${folderItem}/${galleryFolder}`)) || params.preview) {
            yield folderItem
          }
        }
      }
    }

    this.start = async () => {
      const existing = new Set()

      for (const bPath of basePaths) {
        for await (const gallery of filterGalleries(bPath)) {
          if (!existing.has(gallery)) {
            addGallery(gallery, { preview: params.preview, galleriespath: galPath })
            existing.add(gallery)
          }
        }
      }
    }
  }
}