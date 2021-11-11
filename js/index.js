
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
    preview: (val) => { result.preview = truthy.includes(val.toLowerCase()) }
  }

  for (const k of [...searchParams.keys()]) {
    mapping[k](searchParams.get(k))
  }

  return result
}

const params = getParams()

$(document).ready(async function ($) {
  if (params.initScreenLog) {
    screenLog.init()
  }

  $('.nav-item').filter((idx, elem) => elem.textContent.trim().toLowerCase() === params.galleryFolderName).addClass('active')

  const imports = await Promise.all([
    import('./cache/cache.js'),
    import('./cache/idb/index.js'),
    import('../../settings/config/config.js')
  ])
  const [
    { localStoreCache, indexedDBCache },
    { openDB },
    { Config }
  ] = imports
  const conf = new Config({ params })
  await conf.migrate()
  const config = await conf.get()

  if ((!params?.initScreenLog) && config?.debug?.screenlog?.enabled) {
    screenLog.init()
  }
  const CacheClass = { local: localStoreCache, idb: indexedDBCache }[config.cache?.storage || 'local']

  const cache = new (CacheClass)({ params, conf, openDB })
  cache?.init && await cache.init()

  if (params?.galleryname === null || undefined === params?.galleryname || params?.galleryname === '') {
    const GalleriesListClass = await ({
      tree: () => import('./galleries-list-tree.js'),
      ls: () => import('./galleries-list-ls.js'),
      hasitem: () => import('./galleries-list-has-item.js')
    }[config?.gallerieslist || 'ls']())

    const galleriesList = new (GalleriesListClass)({ params, config, cache })
    galleriesList.start()
  } else {
    const Gallery = await import('./gallery.js')

    $('#gallery').append('<ul id="galleries-list"></ul>')
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
