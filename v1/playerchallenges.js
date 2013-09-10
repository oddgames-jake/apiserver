module.exports = {
	sectionCode: 700,
    list: require(__dirname + "/playerchallenges.list.js"),
    save: require(__dirname + "/playerchallenges.save.js"),
    load: require(__dirname + "/playerchallenges.load.js"),
	update: require(__dirname + "/playerchallenges.update.js"),
	getreplay: require(__dirname + "/playerchallenges.getreplay.js"),
	postresult: require(__dirname + "/playerchallenges.postresult.js")
};