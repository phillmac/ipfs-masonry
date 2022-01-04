export class APIHosts {
	constructor({ params, config }) {
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
			const apiRoute = `${config.api.path}/${config.api[endPointName].route}`

			const endpPointsList = config.api?.endpoints[endPointName]?.hosts
			const enabledApiHosts = Object.keys(endpPointsList)
				.filter(h => endpPointsList[h])
			const hosts = apiDisableCurrentHost ? enabledApiHosts : [...new Set([currentAPIHost, ...enabledApiHosts])]
			return hosts.map(h => `${h}/${apiRoute}?${queryParams.toString()}`)
		}
	}
}