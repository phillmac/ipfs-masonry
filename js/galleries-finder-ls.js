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

export const className = 'GalleriesFinderLS'

export class GalleriesFinderLS {
  constructor({ params, config, cache, fetchline, utils }) {
    const folderCacheTTL = config?.cache?.TTL?.folders || 604800
    const cacheDisabled = Object.keys(config.cache?.disable).filter((k) => config.cache?.disable?.[k] === true)
    const galleryFolder = config?.path?.names?.[params.galleryFolderName] || 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs || 'thumbs'

    const basePaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries

    const apiHosts = new utils.APIHosts({ params, config })

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

        const endPoints = apiHosts.getEndPoints('ls', { arg: folderPath })

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
      console.log(`Finished listing folder ${folderPath}`)
    }

    const hasItem = async (folderPath, itemName) => {
      for await (const item of listFolder(folderPath)) {
        if (item === itemName) {
          return true
        }
      }
      return false
    }

    const hasThumbs = (folderPath) => hasItem(folderPath, thumbsFolder)

    const hasGallery = (folderPath) => hasItem(folderPath, galleryFolder)

    const filterGalleries = async function* (bPath) {

      for await (const folderItem of listFolder(bPath)) {
        if (
          await hasGallery(`${bPath}/${folderItem}`, galleryFolder)
        ) {
          if ((await hasThumbs(`${bPath}/${folderItem}/${galleryFolder}`)) || params.preview) {
            yield folderItem
          }
        }
      }
    }

    const getQueryParams = ({ gallery, page, urlParams }) => {
      const queryParams = new URLSearchParams()
      queryParams.append('galleryname', gallery)
      if (!(config?.pagination?.disabled)) {
        queryParams.append('page', page)
      }
      for (const k of Object.keys(urlParams)) {
        if (urlParams[k] !== undefined) {
          queryParams.set(k, urlParams[k])
        }
      }
      return queryParams.toString()
    }

    const addGallery = (gallery, urlParams) => {
      const queryParams = getQueryParams({ gallery, page: 1, urlParams })

      $('#galleries-list').append(`<div class="page-links"><a href="?${queryParams}">${gallery}</a><br></div>`)
      $('#galleries-list').append($('#galleries-list').children().detach().sort((a, b) => {
        const atxt = a.textContent.toLowerCase()
        const btxt = b.textContent.toLowerCase()
        if (atxt === btxt) return 0
        if (atxt > btxt) return 1
        if (atxt < btxt) return -1
      }))
    }

    this.start = async () => {
      const existing = new Set()

      for (const bPath of basePaths) {
        for await (const gallery of filterGalleries(bPath)) {
          if (!existing.has(gallery)) {
            addGallery(gallery, { preview: params.preview, galleriespath: bPath })
            existing.add(gallery)
          }
        }
      }
    }
  }
}
