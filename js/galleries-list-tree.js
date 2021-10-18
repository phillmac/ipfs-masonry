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

export class GalleriesListTree {
  constructor({ params, config, cache }) {
    const folderCacheTTL = config?.cache?.TTL?.folders || 604800
    const galleryFolder = config?.path?.names?.[params.galleryFolderName] || 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs || 'thumbs'

    const listGalleries = (path) => {

    }

    this.start = () => {
      const existing = new Set()

      const galleriesPaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries

      for (const galPath of galleriesPaths) {
        for await (const gallery of listGalleries(galPath)) {
          if (!existing.has(gallery)) {
            addGallery(gallery, { preview: params.preview, galleriespath: galPath })
            existing.add(gallery)
          }
        }
      }
    }
  }
}