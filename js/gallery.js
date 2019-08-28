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
};

// Markdown
gallery.md = window.markdownit({
	xhtmlOut: true,
	breaks: true,
	linkify: true,
	typographer: true,
});

// Start
gallery.start();
