const gallery = {

	/**
	 * Entry point of the gallery.
	 */
	start: function () {
		gallery.render();
		gallery.ipfs_ready();
	},

	/**
	 * Fetch JSON resources using HoganJS, then display it.
	 */
	render: function () {
		fetch("./json/gallery.json").then(response => response.json()).then(json => {
			json.galleries.forEach((element, index) => {
				if (element.text !== "")
					fetch("https://" + element.cidv1 + ".cf-ipfs.com/" + element.text).then(response => response.text()).then(text => {
						json.galleries[index].text = gallery.md.render(text);
						document.querySelector("#gallery").innerHTML = templates.gallery.render(json);
					});
				else {
					document.querySelector("#gallery").innerHTML = templates.gallery.render(json);
				}
			});
		});
	},

	/**
	 * Setup a local IPFS node.
	 * 1. Connect to LineageOSOnIPFS.com's swarm
	 * 2. Add this gallery's pins to the local node
	 */
	ipfs_ready: function () {
		gallery.ipfs.on("ready", () => {

			// IPFS Swarm Connect
			gallery.ipfs.swarm.connect("/ip6/2604:a880:cad:d0::17:2001/tcp/4001/ipfs/QmSqLAXiJiteNbuNPY4Y5Lp4iKiUmqhCkBZSedZEutktVs", {
				default: true
			}, function (err) {
				console.log(err);
			});
			gallery.ipfs.swarm.connect("/ip4/159.89.116.13/tcp/4001/ipfs/QmSqLAXiJiteNbuNPY4Y5Lp4iKiUmqhCkBZSedZEutktVs", {
				default: true
			}, function (err) {
				console.log(err);
			});

			// IPFS Pin Add
			fetch("./json/gallery.json").then(response => response.json()).then(json => {
				json.galleries.forEach(element => {
					gallery.ipfs.pin.add(element.cidv1, function (err, res) {
						console.log(err, res);
					});
				});
			});
		});
	},
};

// Markdown
gallery.md = window.markdownit({
	xhtmlOut: true,
	breaks: true,
	linkify: true,
	typographer: true,
});

// JS-IPFS
gallery.ipfs = new Ipfs();

// Start
gallery.start();