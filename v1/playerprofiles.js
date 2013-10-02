module.exports = {
	sectionCode: 800,
    load: require(__dirname + "/playerprofiles.load.js"),
	update: require(__dirname + "/playerprofiles.update.js"),
	create: require(__dirname + "/playerprofiles.create.js"),
	ping: require(__dirname + "/playerprofiles.ping.js"),
};