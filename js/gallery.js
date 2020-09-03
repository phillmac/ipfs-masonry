const searchParams = new URLSearchParams(window.location.search);
let pageNo = searchParams.get('page');
let imageCount = searchParams.get('count');
const galleryName = searchParams.get('galleryname');
const initScreenLog = ['true', 'TRUE'].includes(searchParams.get('debug'))
let pageMax = 1;

const galleryFolderName = window.location.pathname.split('/').filter(p => p).slice(-1).pop();


try {
	pageNo = parseInt(pageNo);
	if (imageCount) {
		imageCount = parseInt(imageCount);
	} else {
		imageCount = 20;
	}
} catch { }

if ((!localStorage.cacheVersion) && (localStorage.folders || localStorage.files)) {
	localStorage.cacheVersion = '0.1.0'
}

if (localStorage.cacheVersion === '0.1.0') {
	if (localStorage.folders) {
		console.info(`Folders size before ${localStorage.folders.length}`)
		localStorage.folders = LZString.compress(localStorage.folders)
		console.info(`Folders size after ${localStorage.folders.length}`)
	}

	if (localStorage.files) {
		console.info(`Files size before ${localStorage.files.length}`)
		localStorage.files = LZString.compress(localStorage.files)
		console.info(`Files size after ${localStorage.files.length}`)
	}

	localStorage.cacheVersion = '0.2.0'
}

function jsonParseOrDefault(str, defaultVal) {
	try {
		result = JSON.parse(LZString.decompress(str));
		if (!result) {
			return defaultVal;
		}
		return result
	} catch (e) {
		return defaultVal;
	}
}

function getWithExpiry(key, path) {
	const itemStr = localStorage.getItem(key)
	// if the item doesn't exist, return null
	if (!itemStr) {
		return null
	}
	const keyItem = jsonParseOrDefault(localStorage.getItem(key), {})
	if (!keyItem) {
		return null
	}
	const item = keyItem[path]
	if (!item) {
		return null
	}
	const now = new Date()
	// compare the expiry time of the item with the current time
	if (now.getTime() > item.expiry) {
		// If the item is expired, delete the item from storage
		// and return null
		delete keyItem[path]
		localStorage.setItem(key, JSON.stringify(keyItem))
		return null
	}
	return item.value
}

function setWithExpiry(key, path, value, ttl) {
	const now = new Date()

	// `item` is an object which contains the original value
	// as well as the time when it's supposed to expire
	const item = {
		value: value,
		expiry: now.getTime() + ttl,
	}
	const keyItem = jsonParseOrDefault(localStorage.getItem(key), {})
	keyItem[path] = item
	localStorage.setItem(key, LZString.compress(JSON.stringify(keyItem)))
}

const doFetch = (url, options = {}) => fetch(url, { referrerPolicy: 'no-referrer', ...options })

async function* callApiEndpoints(endPoints) {
	const abort = new AbortController();
	const signal = abort.signal;
	yield* endPoints.map(async ep => {
		try {
			const response = await doFetch(ep, { signal });
			if (response.status === 200) {
				json = await response.json()
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

async function* listFolder(folderPath, itemType, { apiHosts, apiPath, quick = true, folderCacheTTL }) {
	console.log(`Listing folder ${folderPath}`)
	const storageKey = { 1: 'folders', 2: 'files' }[itemType]
	const localResults = getWithExpiry(storageKey, folderPath) || []

	yield* localResults.filter(l => l.Type === itemType).map(lr => lr.Name)

	if (!(quick && localResults.length > 0)) {
		console.log(`Slow ${folderPath} quick: ${quick} length: ${localResults.length}`)

		const endPoints = apiHosts.map(api => `${api}/${apiPath}/ls?arg=${folderPath}`)

		for await (const apiResponse of callApiEndpoints(endPoints)) {
			if (apiResponse.Objects) {
				const object = apiResponse.Objects.find(o => o.Hash === folderPath)
				const localNames = localResults.map(lr => lr.Name)
				const missing = object.Links
					.filter(li => !(localNames.includes(li.Name)))
					.filter(li => li.Type === itemType)
				if (missing.length > 0) {
					setWithExpiry(storageKey, folderPath, [...localResults, ...missing], folderCacheTTL)
					yield* missing.map(li => li.Name)
				}
			}
		}
	}
}


const resolvePath = async (itemPath, { apiHosts, apiPath, resolveCacheTTL }) => {
	const localResult = getWithExpiry('resolvedPaths', itemPath)
	if (localResult) {
		return localResult
	}

	const endPoints = apiHosts.map(api => `${api}/${apiPath}/resolve?arg=${itemPath}`)
	for await (const apiResponse of callApiEndpoints(endPoints)) {
		if (apiResponse.Path) {
			const cidv0 = Multiaddr(apiResponse.Path).stringTuples()[0][1]
			const cidv1 = CidTool.base32(cidv0)
			setWithExpiry('resolvedPaths', itemPath, cidv1, resolveCacheTTL)
			return cidv1
		}
	}
}

const renderJson = (json) => {
	json.galleries.forEach((element, index) => {
		if (pageNo && imageCount) {
			element.folders.forEach((folder) => {
				const imgLen = folder.images.length
				folder.images = folder.images.slice(pageNo * imageCount - imageCount, pageNo * imageCount);
				const maxPage = Math.ceil(imgLen * 1.0 / imageCount)
				pageMax = maxPage > pageMax ? maxPage : pageMax
			});
		}
		if (element.text !== "")
			doFetch("https://" + element.cidv1 + ".ipfs.cf-ipfs.com/" + element.text).then(response => response.text()).then(text => {
				json.galleries[index].text = gallery.md.render(text);
				document.querySelector("#gallery").innerHTML = templates.gallery.render(json);
			});
		else {
			document.querySelector("#gallery").innerHTML = templates.gallery.render(json);
		}
	});
}
const listGalleries = (galleriesPath, options) => listFolder(galleriesPath, 1, { ...options, quick: false })

const listGallery = async (galleryPath, options) => {
	const results = [];
	for await (const item of listFolder(galleryPath, 2, options)) {
		results.push(item);
	}
	return results
}

const buildJson = async (galleryPath, options) => {
	return {
		author: 'DeviantArt IPFS Archive',
		description: '',
		galleries: [
			{
				cidv1: await resolvePath(galleryPath, options),
				title: galleryName,
				text: '',
				folders: [
					{
						path: '.',
						images: await listGallery(galleryPath, options)
					}
				]
			}
		]
	}
}

const addGallery = (gallery, gpQuery) => {
	$('#galleries-list').append(`<div class="page-links"><a href="?galleryname=${gallery}&page=1${gpQuery}">${gallery}</a><br></div>`);
	$('#galleries-list').append($('#galleries-list').children().detach().sort((a, b) => {
		const atxt = a.textContent.toLowerCase()
		const btxt = b.textContent.toLowerCase()
		if (atxt === btxt) return 0
		if (atxt > btxt) return 1
		if (atxt < btxt) return -1
	}));
}

const hasThumbs = async (folderPath, options) => {
	for await (const item of listFolder(folderPath, 1, options)) {
		if (item === 'thumbs') {
			return true
		}
	}
}

const hasGallery = async (folderPath, galleryFolder, options) => {
	for await (const item of listFolder(folderPath, 1, options)) {
		if (item === galleryFolder) {
			return true
		}
	}
}



const gallery = {

	/**
	 * Entry point of the gallery.
	 */
	start: function () {
		gallery.render();
	},

	/**
	 * Fetch JSON resources using HoganJS, then display it.
	 */
	render: function () {
		if (!localStorage.config) {
			localStorage.config = JSON.stringify({})
		}
		doFetch('../settings/config/default.json')
			.then(response => response.json())
			.then(json => $.extend(json, JSON.parse(localStorage.config)))
			.then(async config => {
				console.debug({ config })
				const galleriesPath = searchParams.get('galleriespath') || config.galleriesPath;
				const galleryFolder = config.pathNames[galleryFolderName];
				const noApiHostNames = config.noApiHostNames;
				const folderCacheTTL = config.folderCacheTTL * 1000
				const resolveCacheTTL = config.resolveCacheTTL * 1000
				const apiHosts = noApiHostNames.find(hn => window.location.hostname.includes(hn)) ? config.apiHosts : [...new Set([window.location.origin, ...config.apiHosts])];
				const apiPath = config.apiPath;
				const galleryPath = `${galleriesPath}/${galleryName}/${galleryFolder}`;
				const gpQuery = galleriesPath !== config.galleriesPath ? `&galleriespath=${galleriesPath}` : ''
				const options = { apiHosts, apiPath, folderCacheTTL, resolveCacheTTL }

				console.log({ galleryFolder })

				if (galleryName) {
					buildJson(galleryPath, options)
						.then(json => renderJson(json))
						.then(() => {
							$('#loader').hide()
							if (pageNo && imageCount) {
								if (pageNo > 1) {
									$(".page-links").append(`<a href="?galleryname=${galleryName}&page=1${gpQuery}"><<< First </a>&nbsp;&nbsp;&nbsp;&nbsp;`)
									$(".page-links").append(`<a href="?galleryname=${galleryName}&page=${pageNo - 1}${gpQuery}"> < Prev</a>&nbsp;&nbsp;&nbsp;&nbsp;`)
								}
								if (pageNo <= pageMax - 1) {
									$(".page-links").append(`<a href="?galleryname=${galleryName}&page=${pageNo + 1}${gpQuery}">Next ></a>&nbsp;&nbsp;&nbsp;&nbsp;`)
									$(".page-links").append(`<a href="?galleryname=${galleryName}&page=${pageMax}${gpQuery}">Last >>></a>`)
								}
							}

							$('.js-add-bookmark').on('click', function () {
								const $el = $(this)
								const bookmark = $el.data('bookmarkName')
								console.log({ bookmark })
								localStorage.bookmark = $el.data('bookmarkName')
							})

							if (localStorage.bookmark) {
								const bookmark = localStorage.bookmark
								delete localStorage.bookmark
								console.log({ bookmark })
								const $el = $(`[data-bookmark-name="${bookmark}"]`)
								$('html, body').scrollTop($el.offset().top);
							}
						});
				} else {
					$('#gallery').append('<ul id="galleries-list"></ul>');
					for await (const gallery of listGalleries(galleriesPath, options)) {
						if (
							await hasGallery(`${galleriesPath}/${gallery}`, galleryFolder, options) &&
							await hasThumbs(`${galleriesPath}/${gallery}/${galleryFolder}`, options)
						) {
							addGallery(gallery, gpQuery)
						}
					}
					$('#loader').hide();
				}
			});
	}
}

// Markdown
gallery.md = window.markdownit({
	xhtmlOut: true,
	breaks: true,
	linkify: true,
	typographer: true,
});

// Start


// Masonry
$(document).ready(function ($) {
	$('.nav-item').filter((idx, elem) => elem.textContent.trim().toLowerCase() === galleryFolderName).addClass('active')

	gallery.start();

	if (initScreenLog) {
		screenLog.init()
	}
	setTimeout(function () {

		// Init Masonry
		const $grid = $('.grid').masonry({
			itemSelector: '.grid-item',
			columnWidth: '.grid-sizer',
			percentPosition: true,
		});

		// Layout Masonry after each image loads
		document.addEventListener('lazybeforeunveil', (e) => $grid.masonry('layout'));
		document.addEventListener('lazyloaded', (e) => $grid.masonry('layout'));
		document.addEventListener('lazybeforesizes', (e) => $grid.masonry('layout'));

	}, 1000);
});
