
const getParams = () => {
  const searchParams = new URLSearchParams(window.location.search)

  const result = {
    galleryFolderName: window.location.pathname.split('/').filter(p => p).slice(-1).pop(),
    pageMax: 1
  }

  const mapping = {
    galleryname: (val) => { result.galleryName = val },
    debug: (val) => { result.initScreenLog = ['true', 'TRUE'].includes(val) },
    itemsperpage: (val) => { result.pagination = { itemsPerPage: parseInt(val) } },
    page: (val) => { result.pageNo = parseInt(val) },
    galleriespath: (val) => { result.path = { galleries: val } }
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

  const imports = await Promise.all([import('./gallery.js'), import('./cache/cache.js'), import('../../settings/config/config.js')])
  const [{ Gallery }, { Cache }, { Config }] = imports
  console.log({ Gallery, Cache, Config })
  const config = new Config({ params })
  await config.migrate()
  const cache = new Cache({ config })

  const gallery = new Gallery({ params, config: await config.get(), cache })
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
})
