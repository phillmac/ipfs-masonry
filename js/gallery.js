const gallery = {
	start: function () {
		gallery.render();
		gallery.pin();
	},

	render: async function () {
		fetch("./json/gallery.json").then(response => response.json()).then(json => {
			json.galleries.forEach((element, index) => {
				fetch("https://" + element.base32 + ".cf-ipfs.com/" + element.text).then(response => response.text()).then(text => {
					json.galleries[index].text = gallery.md.render(text);
					document.querySelector("#gallery").innerHTML = templates.gallery.render(json);
				});
			});
		});
	},

	pin: function () {
		gallery.ipfs.on("ready", () => {
			fetch("./json/gallery.json").then(response => response.json()).then(json => {
				json.galleries.forEach(element => {
					console.log("ipfs pin add " + element.base32);
					gallery.ipfs.pin.add(element.base32, function (err, res) {
						console.log(err, res);
					});
				});
			});
		});
	}
};

// Initialize libraries
gallery.md = window.markdownit();
gallery.ipfs = new Ipfs();

// Initialize application
gallery.start();