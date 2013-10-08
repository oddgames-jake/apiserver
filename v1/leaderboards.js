module.exports = {
	sectionCode: 200,
    list: require(__dirname + "/leaderboards.list.js"),
    save: require(__dirname + "/leaderboards.save.js"),
    saveandlist: require(__dirname + "/leaderboards.saveandlist.js"),
    getreplay: require(__dirname + "/leaderboards.getreplay.js"),
    surroundingscores: require(__dirname + "/leaderboards.surroundingscores.js"),
    getrivalreplays: require(__dirname + "/leaderboards.getrivalreplays.js")
};