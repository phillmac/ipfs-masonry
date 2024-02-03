export class API {
	constructor({ config, utils }) {
		const hostNameLookups = config.api?.hostNameLookups
			.filter(i => i.enabled)

		const hostNameEntry = hostNameLookups.find((i) => {
			return window.location.hostname.match(i.key)
		})

		const currentAPIHostName = hostNameEntry ? hostNameEntry.value : window.location.hostname
		const currentAPIHost = `${window.location.protocol}//${currentAPIHostName}:${window.location.port}`

		const apiDisableCurrentHost = Boolean(
			Object.keys(config.api?.disabledHostNames)
				.filter(hn => config.api.disabledHostNames[hn])
				.find(hn => currentAPIHostName.match(hn))
		)

		this.getEndPoints = (endPointName, urlParams) => {
			const queryParams = new URLSearchParams()
			for (const k of Object.keys(urlParams)) {
				if (urlParams[k] !== undefined) {
					queryParams.set(k, urlParams[k])
				}
			}
			const apiRoute = `${config.api.path}/${config.api.endpoints[endPointName].route}`

			const endpPointsList = config.api?.endpoints[endPointName]?.hosts ?? []
			const enabledApiHosts = Object.keys(endpPointsList)
				.filter(h => endpPointsList[h])
			const hosts = apiDisableCurrentHost ? enabledApiHosts : [...new Set([currentAPIHost, ...enabledApiHosts])]
			return hosts.map(h => `${h}/${apiRoute}?${queryParams.toString()}`)
		}

		this.callApiEndpoints = async function* (endPoints) {
			const abort = new AbortController()
			const signal = abort.signal
			yield* endPoints.map(async ep => {
				try {
					const response = await utils.doFetch(ep, { signal })
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

		this.unpackLSResponse = function ({ apiResponse, folderPath, itemType }) {
			if (apiResponse.Objects) {
				const object = apiResponse.Objects.find(o => o.Hash === folderPath)
				return object.Links.filter(li => li.Type === itemType)
			}
		}

		this.unpackApiResponse = function ({ endpointName, apiResponse, folderPath, itemType }) {
			const unpack = {
				'ls': () => this.unpackLSResponse({ apiResponse, folderPath })
			}[endpointName]

			return unpack()
		}


		this.listFolder = async function* (endpointName, folderPath, itemType, storageKey, quick = true) {

			console.log(`Listing folder ${folderPath}`)

			const localResults = []

			if (cacheDisabled.includes(storageKey)) {
				console.debug(`${storageKey} cache is disabled`)
			} else {
				(await cache.getWithExpiry(storageKey, folderPath) ?? []).forEach(i => localResults.push(i))
				yield* localResults.filter(l => l.Type === itemType).map(lr => lr.Name)
			}

			if (!(quick && localResults.length > 0)) {
				console.debug(`Slow ${folderPath} quick: ${quick} length: ${localResults.length}`)

				const endPoints = this.getEndPoints(endpointName, { arg: folderPath })

				for await (const apiResponse of this.callApiEndpoints(endPoints)) {

					const localNames = localResults.map(lr => lr.Name)

					const missing = this.unpackApiResponse(endpointName, apiResponse, folderPath, itemType)
						.filter(li => !(localNames.includes(li.Name)))

					if (missing.length > 0) {
						await cache.setWithExpiry(storageKey, folderPath, [...localResults, ...missing], cacheTTL)
						yield* missing.map(li => li.Name)
					}
				}
			}
			console.log(`Finished listing folder ${folderPath}`)
		}

		this.hasItem = async function (endpointName, folderPath, itemType, storageKey) {
			const policyEnabled = ['fallback', 'has-item-only', 'true', 'enabled']
			const policyValue = config.api?.endpoints?.hasItem?.policy
			const hasItemCacheTTL = config?.cache?.TTL?.hasItem ?? 604800

			if (policyEnabled.includes(policyValue)) {
				const cachePath = `${folderPath} . ${itemName}`

				if (cacheDisabled.includes('hasItem')) {
					console.debug('hasItem cache is disabled')
				} else {
					const cacheResult = await cache.getWithExpiry('has-item', cachePath)
					if (cacheResult === true || cacheResult === false) {
						return cacheResult
					}
				}

				const hasItemEndpoints = this.getEndPoints('hasItem', { path: folderPath, item: itemName })
				if (hasItemEndpoints.length > 0) {
					for await (const apiResponse of this.callApiEndpoints(hasItemEndpoints)) {
						if (apiResponse === true || apiResponse === false) {
							cache.setWithExpiry('has-item', cachePath, apiResponse, hasItemCacheTTL)
							return apiResponse
						}
					}
				}

				if (policyValue === 'has-item-only') {
					throw new Error('Has item api misconfigured')
				}
			}

			for await (const item of listFolder(endpointName, folderPath, itemType, storageKey)) {
				if (item === itemName) {
					return true
				}
			}
			return false
		}
	}
}

