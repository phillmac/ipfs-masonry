export class Gallery {
  constructor ({ params, config, cache }) {
    console.debug({ params, config })

    class QueryablePromise extends Promise {
      constructor (executor) {
        super((resolve, reject) => executor(
          data => {
            resolve(data)
            this._status = 'Resolved'
          },
          err => {
            reject(err)
            this._status = 'Rejected'
          }
        ))
        this._status = 'Pending'
      }

      get status () {
        return this._status
      }
    }

    const gpQuery = params?.path?.galleries ? `&galleriespath=${params.path.galleries}` : ''
    const usePagination = (!config.pagination.disabled) && params.pageNo
    const itemsPerPage = config.pagination.itemsPerPage
    const galleryFolder = config.path.names[params.galleryFolderName]
    const folderCacheTTL = config.cache.TTL.folders
    const resolveCacheTTL = config.cache.TTL.resolve
    const fileCacheTTL = config.cache.TTL.files

    const apiDisableCurrentHost = Boolean(
      Object.keys(config.api.disabledHostNames)
        .filter(hn => config.api.disabledHostNames[hn])
        .find(hn => window.location.hostname.includes(hn)))
    const enabledApiHosts = Object.keys(config.api.hosts)
      .filter(h => config.api.hosts[h])
    const apiHosts = apiDisableCurrentHost ? enabledApiHosts : [...new Set([window.location.origin, ...enabledApiHosts])]

    const doFetch = (url, options = {}) => fetch(url, { referrerPolicy: 'no-referrer', ...options })

    async function * callApiEndpoints (endPoints) {
      const abort = new AbortController()
      const signal = abort.signal
      yield * endPoints.map(async ep => {
        try {
          const response = await doFetch(ep, { signal })
          if (response.status === 200) {
            const json = await response.json()
            abort.abort()
            return json
          } else {
            return {}
          }
        } catch {
          return {}
        }
      })
    }

    this.findGallery = async () => {
      if (typeof config.path.galleries === 'string') return config.path.galleries
      if (config.path.galleries.length === 1) return [...config.path.galleries].pop()
      let result

      const search = async (g) => {
        try {
          for await (const i of this.listGalleries(g)) {
            if (i === params.galleryName) { return g }
          }
        } catch (err) {
          console.error(err)
        }
      }

      const listings = config.path.galleries.map(g => new QueryablePromise((resolve, reject) => search(g).then(r => resolve(r))))

      while (!result) {
        const temp = await Promise.race(listings.filter(p => p.status === 'Pending'))
        if (temp) result = temp
      }
      return result
    }

    this.listFolder = async function * (folderPath, itemType, quick = true) {
      console.log(`Listing folder ${folderPath}`)
      const storageKey = { 1: 'folders', 2: 'files' }[itemType]
      const cacheTTL = { 1: folderCacheTTL, 2: fileCacheTTL }[itemType]
      const localResults = cache.getWithExpiry(storageKey, folderPath) || []

      yield * localResults.filter(l => l.Type === itemType).map(lr => lr.Name)

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
              cache.setWithExpiry(storageKey, folderPath, [...localResults, ...missing], cacheTTL)
              yield * missing.map(li => li.Name)
            }
          }
        }
      }
    }

    this.resolvePath = async (itemPath) => {
      const localResult = cache.getWithExpiry('resolvedPaths', itemPath)
      if (localResult) {
        return localResult
      }

      const endPoints = apiHosts.map(api => `${api}/${config.api.path}/resolve?arg=${itemPath}`)
      for await (const apiResponse of callApiEndpoints(endPoints)) {
        if (apiResponse.Path) {
          const cidv0 = Multiaddr(apiResponse.Path).stringTuples()[0][1]
          const cidv1 = CidTool.base32(cidv0)
          cache.setWithExpiry('resolvedPaths', itemPath, cidv1, resolveCacheTTL)
          return cidv1
        }
      }
    }

    this.renderJson = (json) => {
      json.galleries.forEach((element, index) => {
        if (usePagination) {
          element.folders.forEach((folder) => {
            const imgLen = folder.images.length
            folder.images = folder.images.slice(params.pageNo * itemsPerPage - itemsPerPage, params.pageNo * itemsPerPage)
            const maxPage = Math.ceil(imgLen * 1.0 / itemsPerPage)
            params.pageMax = maxPage > params.pageMax ? maxPage : params.pageMax
          })
        }
        if (element.text !== '') {
          doFetch('https://' + element.cidv1 + '.ipfs.cf-ipfs.com/' + element.text).then(response => response.text()).then(text => {
            json.galleries[index].text = this.md.render(text)
            document.querySelector('#gallery').innerHTML = templates.gallery.render(json)
          })
        } else {
          document.querySelector('#gallery').innerHTML = templates.gallery.render(json)
        }
      })
    }
    this.listGalleries = (galleriesPath) => this.listFolder(galleriesPath, 1, false)

    this.listGallery = async (galleryPath) => {
      const results = []
      for await (const item of this.listFolder(galleryPath, 2)) {
        results.push(item)
      }
      return results
    }

    this.buildJson = async (galleryPath) => {
      const galleryContents = await this.listGallery(galleryPath)
      const hasVideo = galleryContents.some(i => config.gateway.useAlternateExtentions.some(e => i.includes(e)))
      const gatewayHost = hasVideo
        ? config.gateway.hosts.alternate : config.gateway.hosts.primary

      const gateway = config.gateway.useOrigin ? window.location.origin : `https://${gatewayHost}`
      console.debug({ gateway })
      return {
        author: 'DeviantArt IPFS Archive',
        description: '',
        galleries: [
          {
            gateway,
            cidv1: await this.resolvePath(galleryPath),
            title: params.galleryName,
            text: '',
            folders: [
              {
                path: '.',
                images: galleryContents
              }
            ]
          }
        ]
      }
    }

    this.addGallery = (gallery, galPath = '') => {
      $('#galleries-list').append(`<div class="page-links"><a href="?galleriespath=${galPath}&galleryname=${gallery}&page=1${gpQuery}">${gallery}</a><br></div>`)
      $('#galleries-list').append($('#galleries-list').children().detach().sort((a, b) => {
        const atxt = a.textContent.toLowerCase()
        const btxt = b.textContent.toLowerCase()
        if (atxt === btxt) return 0
        if (atxt > btxt) return 1
        if (atxt < btxt) return -1
      }))
    }

    this.hasThumbs = async (folderPath) => {
      for await (const item of this.listFolder(folderPath, 1)) {
        if (item === 'thumbs') {
          return true
        }
      }
    }

    this.hasGallery = async (folderPath, galleryFolder) => {
      for await (const item of this.listFolder(folderPath, 1)) {
        if (item === galleryFolder) {
          return true
        }
      }
    }

    /**
     * Entry point of the gallery.
     */
    this.start = () => this.render()

    /**
     * Fetch JSON resources using HoganJS, then display it.
     */
    this.render = async () => {
      if (params.galleryName) {
        const galleryPath = `${await this.findGallery()}/${params.galleryName}/${galleryFolder}`
        console.debug({ galleryPath })

        this.buildJson(galleryPath)
          .then(json => this.renderJson(json))
          .then(() => {
            $('#loader').hide()
            if (usePagination) {
              if (params.pageNo > 1) {
                $('.page-links').append(`<a href="?galleryname=${params.galleryName}&page=1${gpQuery}"><<< First </a>&nbsp;&nbsp;&nbsp;&nbsp;`)
                $('.page-links').append(`<a href="?galleryname=${params.galleryName}&page=${params.pageNo - 1}${gpQuery}"> < Prev</a>&nbsp;&nbsp;&nbsp;&nbsp;`)
              }
              if (params.pageNo <= params.pageMax - 1) {
                $('.page-links').append(`<a href="?galleryname=${params.galleryName}&page=${params.pageNo + 1}${gpQuery}">Next ></a>&nbsp;&nbsp;&nbsp;&nbsp;`)
                $('.page-links').append(`<a href="?galleryname=${params.galleryName}&page=${params.pageMax}${gpQuery}">Last >>></a>`)
              }
            }

            $('.js-add-bookmark').on('click', function () {
              const $el = $(this)
              const bookmark = $el.data('bookmarkName')
              localStorage.bookmark = bookmark
            })

            if (localStorage.bookmark) {
              const bookmark = localStorage.bookmark
              delete localStorage.bookmark
              const $el = $(`[data-bookmark-name="${bookmark}"]`)
              if ($el) {
                setTimeout(function () {
                  $('html, body').scrollTop($el.offset().top)
                }, 1000)
              }
            }
          })
      } else {
        $('#gallery').append('<ul id="galleries-list"></ul>')
        const existing = new Set()
        const galleriesPaths = typeof config.path.galleries === 'string' ?  [config.path.galleries] : config.path.galleries
        for (const galPath of galleriesPaths) {
          for await (const gallery of this.listGalleries(galPath)) {
            if (
              (!(existing.has(gallery))) &&
              await this.hasGallery(`${galPath}/${gallery}`, galleryFolder) &&
              await this.hasThumbs(`${galPath}/${gallery}/${galleryFolder}`)
            ) {
              this.addGallery(gallery, galPath)
              existing.add(gallery)
            }
          }
        }
        $('#loader').hide()
      }
    }

    this.md = window.markdownit({
      xhtmlOut: true,
      breaks: true,
      linkify: true,
      typographer: true
    })
  }
}
