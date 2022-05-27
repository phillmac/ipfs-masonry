
const getParams = () => {
  const searchParams = new URLSearchParams(window.location.search)

  const result = {
    galleryFolderName: window.location.pathname.split('/').filter(p => p).slice(-1).pop(),
    pageMax: 1
  }

  const truthy = ['1', 'true', 'yes', 'on']

  const mapping = {
    galleryname: (val) => { result.galleryName = val },
    debug: (val) => { result.initScreenLog = truthy.includes(val.toLowerCase()) },
    itemsperpage: (val) => { result.pagination = { itemsPerPage: parseInt(val) } },
    page: (val) => { result.pageNo = parseInt(val) },
    galleriespath: (val) => { result.path = { galleries: [val] } },
    preview: (val) => { result.preview = truthy.includes(val.toLowerCase()) },
    galleriesfinder: (val) => { result.galleriesFinder = val }
  }

  for (const k of [...searchParams.keys()]) {
    mapping[k](searchParams.get(k))
  }

  return result
}

const params = getParams()

$(document).ready(async function ($) {
  if (params.initScreenLog) {
    window.screenLog.init()
  }

  $('.nav-item').filter((idx, elem) => elem.textContent.trim().toLowerCase() === params.galleryFolderName).addClass('active')

  const imports = await Promise.all([
    import('./version.js'),
    import('./cache/cache.js'),
    import('./cache/idb/index.js'),
    import('../../settings/config/config.js'),
    // import('./fetchline/index.js'),
    import('./utils.js')
  ])
  const [
    { version },
    { localStoreCache, indexedDBCache },
    { openDB },
    { Config },
    // { fetchline },
    { utils }
  ] = imports

  const fetchline = await import('./fetchline/index.js')
  const { APIHosts } = utils

  const conf = new Config({ params })
  await conf.migrate()
  const config = await conf.get()

  if ((!params?.initScreenLog) && config?.debug?.screenlog?.enabled) {
    window.screenLog.init()
  }
  console.info('Version:', version)

  if (version.includes('rc')) {
    document.title = 'IPFS Archive v' + version
  }

  const CacheClass = { local: localStoreCache, idb: indexedDBCache }[config.cache?.storage || 'local']

  const cache = new (CacheClass)({ params, conf, openDB })
  cache?.init && await cache.init()

  const gallName = params?.galleryName
  console.debug({ gallName })

  if (gallName === null || undefined === gallName || gallName === '') {
    $('#gallery').append('<ul id="galleries-list"></ul>')

    console.debug({ galleriesFinder: config?.galleriesFinder })

    const GalleriesFinderClass = await ({
      tree: () => import('./galleries-finder-tree.js'),
      ls: () => import('./galleries-finder-ls.js'),
      hasitem: () => import('./galleries-finder-has-item.js')
    }[config?.galleriesFinder || 'ls']())

    const galleriesFinder = new (GalleriesFinderClass[GalleriesFinderClass.className])({ params, config, cache, fetchline, utils: { APIHosts } })
    galleriesFinder.start().then(() => $('#loader').hide())
  } else {
    const { Gallery } = await import('./gallery.js')

    const gallery = new Gallery({ params, config, cache })
    gallery.start()

    setTimeout(function () {
      // Init Masonry
      const $grid = $('.grid').masonry({
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true
      })

      // Layout Masonry after each image loads
      document.addEventListener('lazybeforeunveil', (e) => $grid.masonry('layout'))
      document.addEventListener('lazyloaded', (e) => $grid.masonry('layout'))
      document.addEventListener('lazybeforesizes', (e) => $grid.masonry('layout'))
    }, 1000)
  }
})
