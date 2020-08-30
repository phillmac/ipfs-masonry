const searchParams = new URLSearchParams(window.location.search);
let pageNo = searchParams.get('page');
let imageCount = searchParams.get('count');
const galleryName = searchParams.get('galleryname');

let pageMax = 1;

try {
	pageNo = parseInt(pageNo);
	if (imageCount) {
		imageCount = parseInt(imageCount);
	} else {
		imageCount = 20;
	}
} catch { }

function jsonParseOrDefault(str, defaultVal) {
	try {
		result = JSON.parse(str);
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
	localStorage.setItem(key, JSON.stringify(keyItem))
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

async function* listFolder(folderPath, itemType, { apiHosts, apiPath, quick = true }) {
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
					setWithExpiry(storageKey, folderPath, [...localResults, ...missing], 3600 * 24 * 1 * 1000)
					yield* missing.map(li => li.Name)
				}
			}
		}
	}
}


const resolvePath = async (itemPath, { apiHosts, apiPath }) => {
	const localResult = getWithExpiry('resolvedPaths', itemPath)
	if (localResult) {
		return localResult
	}

	const endPoints = apiHosts.map(api => `${api}/${apiPath}/resolve?arg=${itemPath}`)
	for await (const apiResponse of callApiEndpoints(endPoints)) {
		if (apiResponse.Path) {
			const cidv0 = Multiaddr(apiResponse.Path).stringTuples()[0][1]
			const cidv1 = CidTool.base32(cidv0)
			setWithExpiry('resolvedPaths', itemPath, cidv1, 3600 * 24 * 30 * 1000)
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
const listGalleries = (galleriesPath, { apiHosts, apiPath }) => listFolder(galleriesPath, 1, { apiHosts, apiPath, quick: false })

const listGallery = async (galleryPath, { apiHosts, apiPath }) => {
	const results = [];
	for await (const item of listFolder(galleryPath, 2, { apiHosts, apiPath })) {
		results.push(item);
	}
	return results
}

const buildJson = async (galleryPath, { apiHosts, apiPath }) => {
	return {
		author: 'DeviantArt IPFS Archive',
		description: '',
		galleries: [
			{
				cidv1: await resolvePath(galleryPath, { apiHosts, apiPath }),
				title: galleryName,
				text: '',
				folders: [
					{
						path: '.',
						images: await listGallery(galleryPath, { apiHosts, apiPath })
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

const hasThumbs = async (folderPath, { apiHosts, apiPath }) => {
	for await (const item of listFolder(folderPath, 1, { apiHosts, apiPath })) {
		if (item === 'thumbs') {
			return true
		}
	}
}

const hasGallery = async (folderPath, galleryFolder, { apiHosts, apiPath }) => {
	for await (const item of listFolder(folderPath, 1, { apiHosts, apiPath })) {
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
		doFetch('./json/config.json')
			.then(response => response.json())
			.then(async config => {
				const galleriesPath = searchParams.get('galleriespath') || config.galleriesPath;
				const galleryFolder = config.galleryFolder;
				const noApiHostNames = config.noApiHostNames;
				const apiHosts = noApiHostNames.find(hn => window.location.hostname.includes(hn)) ? config.apiHosts : [...new Set([window.location.origin, ...config.apiHosts])];
				const apiPath = config.apiPath;
				const galleryPath = `${galleriesPath}/${galleryName}/${galleryFolder}`;
				const gpQuery = galleriesPath !== config.galleriesPath ? `&galleriespath=${galleriesPath}` : ''

				if (galleryName) {
					buildJson(galleryPath, { apiHosts, apiPath })
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
						});
				} else {
					$('#gallery').append('<ul id="galleries-list"></ul>');
					for await (const gallery of listGalleries(galleriesPath, { apiHosts, apiPath })) {
						if (
							await hasGallery(`${galleriesPath}/${gallery}`, galleryFolder, { apiHosts, apiPath }) &&
							await hasThumbs(`${galleriesPath}/${gallery}/${galleryFolder}`, { apiHosts, apiPath })
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
gallery.start();

// Masonry
$(document).ready(function ($) {
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
