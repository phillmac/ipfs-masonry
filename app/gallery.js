export class Gallery {
  constructor({ params, config, cache, utils }) {
    console.debug({ params, config })


    const usePagination = (!config.pagination.disabled) && Boolean(params.pageNo)
    const itemsPerPage = config?.pagination?.itemsPerPage ?? 20
    const galleryFolder = config?.path?.names?.[params.galleryFolderName] ?? 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs ?? 'thumbs'

    const apiHosts = new utils.APIHosts({ params, config })

    /**
  * Entry point of the gallery.
  */
    this.start = () => this.render()

    this.hasThumbs = (folderPath) => utils.hasItem(folderPath, thumbsFolder, 1)

    this.hasGallery = (folderPath) => utils.hasItem(folderPath, galleryFolder, 1)


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

      const listings = config.path.galleries.map(g => new utils.QueryablePromise((resolve, reject) => search(g).then(r => resolve(r))))

      while (!result) {
        const temp = await Promise.race(listings.filter(p => p.status === 'Pending'))
        if (temp) result = temp
      }
      return result
    }



    this.listGalleries = (galleriesPath) => (new utils.folderLister({ config, apiHosts })).getList('ls', galleriesPath, 1, false)

    this.listGallery = async (galleryPath) => {
      const results = []
      // const filter = [config.path?.files?.text]
      for await (const item of this.listFolder('ls', galleryPath, 2)) {
        // if (!(filter.includes(item))) {
        results.push(item)
        // }
      }
      return results
    }

    this.displayGallery = async ({ galleriesPath, fullGalleryPath }) => {

      const specialFileNames = Object.keys(config.path?.files)
        .map(k => config.path?.files[k])
        .filter(v => typeof v === 'string')

      console.debug({ specialFileNames })

      const galleryContents = (await this.listGallery(fullGalleryPath))
        .filter(fn => !(specialFileNames.includes(fn)))

      const galleryPage = usePagination
        ? galleryContents
          .slice(params.pageNo * itemsPerPage - itemsPerPage, params.pageNo * itemsPerPage)
        : galleryContents

      const hasVideo = galleryPage.some(i => config.gateway.useAlternateExtentions.some(e => i.includes(e)))

      const gatewayHost = hasVideo
        ? config.gateway.hosts.alternate
        : config.gateway.hosts.primary

      const useOrigin = () => {
        const gatewayDisableCurrentHost = Boolean(
          Object.keys(config.gateway.disabledHostNames)
            .filter(hn => config.gateway.disabledHostNames[hn])
            .find(hn => window.location.hostname.match(hn))
        )

        return gatewayDisableCurrentHost ? false : config.gateway.useOrigin

      }

      const gateway = useOrigin() ? window.location.origin : `https://${gatewayHost}`
      console.debug({ gateway })

      if (usePagination) {
        const imgLen = galleryContents.length
        const maxPage = Math.ceil(imgLen * 1.0 / itemsPerPage)
        params.pageMax = maxPage > params.pageMax ? maxPage : params.pageMax
      }

      const sortContents = (contents) => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
        const useFileIDNo = config?.sort?.useFileIDNo

        const getSortName = (n) => {
          if (useFileIDNo) {
            const result = /(\d+)(?!.*\d)/.exec(n)
            return result
          }
          return n
        }

        const items = contents.map(c => {
          return {
            originalName: c,
            sortName: getSortName(c)
          }
        })

        const sorted = items.sort((a, b) => collator.compare(a.sortName, b.sortName)).map(i => i.originalName)
        if (config?.sort?.reverse) {
          return sorted.reverse()
        }
        return sorted
      }

      const buildGallery = async () => {
        let authorTextRendered
        const authorFile = config.path?.files?.authortext ?? 'authortext.md'

        try {
          const galleriesPathResolved = await api.resolvePath(galleriesPath)
          const authorTextPath = `${gateway}/ipfs/${galleriesPathResolved}/${authorFile}`
          authorTextRendered = await utils.renderMD(authorTextPath)

        } catch (err) {
          console.error(err)
          authorTextRendered = ''
        }

        return {
          author: authorTextRendered,
          description: '',
          galleries: [
            {
              thumbs_dir: params.preview ? '' : `/${thumbsFolder}`,
              thumbs_ext: params.preview ? '' : config?.path?.files?.extentions?.thumbs || '.jpg',
              gateway,
              cidv1: await api.resolvePath(fullGalleryPath),
              title: params.galleryName,
              text: config.path?.files?.text,
              folders: [
                {
                  path: '.',
                  images: config?.sort?.natural ? sortContents(galleryPage) : galleryPage
                }
              ]
            }
          ]
        }
      }

      const renderGallery = async (json) => {
        for (const galleryItem of json.galleries) {
          if (galleryItem.text) {
            try {
              galleryItem.text = await utils.renderMD(`${gateway}/ipfs/${galleryItem.cidv1}/${galleryItem.text}`)

            } catch {
              galleryItem.text = ''
            }
          }
          document.querySelector('#gallery').innerHTML = templates.gallery.render(json)
        }
      }

      return buildGallery().then(json => renderGallery(json))
    }

    /**
      * Fetch JSON resources using HoganJS, then display it.
      */
    this.render = async () => {
      if (params.galleryName) {
        const galleriesPath = await this.findGallery()
        const fullGalleryPath = `${galleriesPath}/${params.galleryName}/${galleryFolder}`
        console.debug({ galleriesPath, fullGalleryPath })
        const urlParams = { preview: params.preview, galleriespath: galleriesPath }

        await this.displayGallery({ galleriesPath, fullGalleryPath })

        $('#loader').hide()
        if (usePagination) {
          if (params.pageNo > 1) {
            const firstPage = utils.getQueryParams({ gallery: params.galleryName, page: 1, urlParams })
            const prevPage = utils.getQueryParams({ gallery: params.galleryName, page: params.pageNo - 1, urlParams })
            $('.page-links').append(`<a class="first-link" href="?${firstPage}"><<< First </a>&nbsp;&nbsp;&nbsp;&nbsp;`)
            $('.page-links').append(`<a class="prev-link" href="?${prevPage}"> < Prev</a>&nbsp;&nbsp;&nbsp;&nbsp;`)
          }
          if (params.pageNo <= params.pageMax - 1) {
            const nextPage = utils.getQueryParams({ gallery: params.galleryName, page: params.pageNo + 1, urlParams })
            const lastPage = utils.getQueryParams({ gallery: params.galleryName, page: params.pageMax, urlParams })
            $('.page-links').append(`<a class="next-link "href="?${nextPage}">Next ></a>&nbsp;&nbsp;&nbsp;&nbsp;`)
            $('.page-links').append(`<a class="last-link" href="?${lastPage}">Last >>></a>`)
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
      } else {
        const existing = new Set()
        const galleriesPaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries
        for (const galPath of galleriesPaths) {
          for await (const gallery of this.listGalleries(galPath)) {
            if (
              (!(existing.has(gallery))) &&
              await this.hasGallery(`${galPath}/${gallery}`, galleryFolder) &&
              ((await this.hasThumbs(`${galPath}/${gallery}/${galleryFolder}`)) || params.preview)
            ) {
              utils.addGallery(gallery, { preview: params.preview, galleriespath: galPath })
              existing.add(gallery)
            }
          }
        }
        $('#loader').hide()
      }
    }
  }
}
