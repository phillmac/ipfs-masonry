
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
    galleriesfinder: (val) => { result.galleriesFinder = val },
    configprofile: (val) => { result.configProfile = val }
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

  const importList = {
    'version': import('./version.js'),
    'cache': import('./cache/cache-v2.js'),
    'idb': import('./cache/idb/index.js'),
    'config': import('../../settings/config/config.js'),
    'fetchline': import('../assets/js/fetchline/index.js'),
    'utils': import('./utils.js'),
    'api': import('./api.js')
  }

  await Promise.all(Object.values(importList))

  const { version } = await importList['version']
  const { localStoreCache, indexedDBCache } = await importList['cache']
  const { openDB } = await importList['idb']
  const { Config } = await importList['config']
  const fetchline = await importList['fetchline']
  const utils = await importList['utils']
  const { API } = await importList['api']

  const conf = params.configProfile ?
    new Config({ profile: params.configProfile, params }) :
    new Config({ params })

  await conf.migrate()
  const config = await conf.get()

  if ((!params?.initScreenLog) && config?.debug?.screenlog?.enabled) {
    window.screenLog.init()
  }
  console.info('Version:', version)

  if (version.includes('rc')) {
    document.title = 'IPFS Archive v' + version
  }

  const CacheClassList = { 'local': localStoreCache, 'idb': indexedDBCache }
  const CacheClassName = config.cache?.storage ?? 'local'
  const CacheClass = CacheClassList[CacheClassName]

  const cache = new (CacheClass)({ params, conf, openDB })
  if (cache?.init) {
    await cache.init()
  }

  const api = new API({ params, config, cache, utils })

  const gallName = params?.galleryName
  console.debug({ gallName })

  if (gallName === null || undefined === gallName || gallName === '') {
    $('#gallery').append('<ul id="galleries-list"></ul>')

    console.debug({ galleriesFinder: config?.galleriesFinder })

    const GalleriesFinderList = {
      'tree': () => import('./galleries-finder-tree.js'),
      'ls': () => import('./galleries-finder-ls.js'),
      'hasitem': () => import('./galleries-finder-has-item.js')
    }

    const GalleriesFinderName = config?.galleriesFinder ?? 'ls'
    const GalleriesFinderLoader = GalleriesFinderList[GalleriesFinderName]
    const GalleriesFinderClass = await GalleriesFinderLoader()

    const galleriesFinder = new (GalleriesFinderClass[GalleriesFinderClass.className])({ params, config, cache, fetchline, utils, api })
    galleriesFinder.start().then(() => $('#loader').hide())
  } else {
    const { Gallery } = await import('./gallery.js')

    const gallery = new Gallery({ params, config, cache, utils, api })
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
