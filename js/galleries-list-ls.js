const folderCacheTTL = config?.cache?.TTL?.folders || 604800

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

const addGallery = (gallery, urlParams) => {
  const queryParams = this.getQueryParams({ gallery, page: 1, urlParams })

  $('#galleries-list').append(`<div class="page-links"><a href="?${queryParams}">${gallery}</a><br></div>`)
  $('#galleries-list').append($('#galleries-list').children().detach().sort((a, b) => {
    const atxt = a.textContent.toLowerCase()
    const btxt = b.textContent.toLowerCase()
    if (atxt === btxt) return 0
    if (atxt > btxt) return 1
    if (atxt < btxt) return -1
  }))
}

export class GalleriesListLS {
  constructor({ params, config, cache }) {
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