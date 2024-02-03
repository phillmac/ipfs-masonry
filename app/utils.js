const md = window.markdownit({
	xhtmlOut: true,
	breaks: true,
	linkify: true,
	typographer: true
})


async function renderMD(mdpath) {

	const response = await doFetch(mdpath)

	if (response.status === 200) {
		const text = await response.text()
		return md.render(text)
	}

	return ''

}

function doFetch(url, options = {}) {
	return fetch(url, { referrerPolicy: 'no-referrer', ...options })
}



function getQueryParams({ gallery, page, urlParams }) {
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

function addGallery(gallery, urlParams) {
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




class QueryablePromise extends Promise {
	constructor(executor) {
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

	get status() {
		return this._status
	}
}

export {
	addGallery,
	doFetch,
	getQueryParams,
	QueryablePromise,
	renderMD,
}