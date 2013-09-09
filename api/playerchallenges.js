var config = require(__dirname + "/config.js"),
    db = require(__dirname + "/database.js"),
    mongodb = require("mongodb"),
    mdouble = mongodb.BSONPure.Double,
    objectid = mongodb.BSONPure.ObjectID,
    md5 = require(__dirname + "/md5.js"),
    utils = require(__dirname + "/utils.js"),
    date = utils.fromTimestamp,
    datetime = require(__dirname + "/datetime.js"),
    errorcodes = require(__dirname + "/errorcodes.js").errorcodes;

var playerchallenges = module.exports = {

    list:function (options, callback) {
		
        var query = {
            filter: {
				publickey: options.publickey,
				playerids: {"$all" : [options.playerid]}
            },
            limit: parseInt(options.maxreturn || "10"),
            cache: false,
        };

        db.playtomic.playerchallenge_challenges.getAndCount(query, function(error, challenges, numchallenges){
            
            if (error) {
                return callback("unable to load challenges (api.playerchallenges.list:65)", errorcodes.GeneralError);
            }
			
            return callback(null, errorcodes.NoError, numchallenges, clean(challenges, options.data));
        });
    },

    load: function(options, callback) {

        if(!options.challengeid) {
            return callback("unable to load challenges (api.playerchallenges.load:86)", errorcodes.GeneralError);
        }
		
        var query = {

            filter: {
				_id: new objectid(options.challengeid)
            },

            limit: 1,
            skip: 0,
            sort: {},
            cache: true,
            cachetime: 120
        };

        db.playtomic.playerchallenge_challenges.get(query, function(error, challenges){
		
            if (error) {
                return callback("error loading challenge (api.playerchallenges.load:96)", errorcodes.GeneralError);
            }

            if (!challenges || challenges.length == 0) {
                return callback("unable to find challenge (api.playerchallenges.load:102)", errorcodes.GeneralError);
            }

            return callback(null, errorcodes.NoError, clean(challenges, true)[0]);
        });
    },

    save: function(options, callback) {

        // small cleanup
        var challenge = {};

        // fields that just aren't relevant, by doing it this way it's easier to extend because you can
        // just add more fields directly in your game and they will end up in your scores and returned
        // to your game
        var exclude = ["section", "action", "ip", "date", "url", "page", "perpage", "filters", "debug"];

        for(var x in options) {
            if(exclude.indexOf(x) > -1) {
                continue;
            }

            challenge[x] = options[x];
        }

        //challenge.hash = md5(options.publickey + "." + options.ip + "." + options.name + "." + options.source);
        challenge.date = datetime.now;

        // check for dupes
        db.playtomic.playerchallenge_challenges.get({ filter: { publickey: challenge.publickey, challengeid: challenge.challengeid }, limit: 1}, function(error, challenges) {

            if (error) {
                return callback("unable to save challenge (api.playerchallenges.save:188)", errorcodes.GeneralError);
            }

            if(challenges && challenges.length > 0) {
                return callback("already saved this challenge", errorcodes.LevelAlreadyExists, clean(challenges, options.data === true)[0]);
            }

            db.playtomic.playerchallenge_challenges.insert({doc: challenge, safe: true}, function(error, challenge) {
                if (error) {
                    return callback("unable to save challenge (api.playerchallenges.save:188)", errorcodes.GeneralError);
                }

                return callback(null, errorcodes.NoError, clean([challenge], true)[0]);
            });
        });
    },
	update: function(options, callback) {
		
        // small cleanup
        var challenge = {};

        // fields that just aren't relevant, by doing it this way it's easier to extend because you can
        // just add more fields directly in your game and they will end up in your scores and returned
        // to your game
        var exclude = ["section", "action", "ip", "date", "url", "page", "perpage", "filters", "debug"];

        for(var x in options) {
            if(exclude.indexOf(x) > -1) {
                continue;
            }

            challenge[x] = options[x];
        }
		
        challenge.date = datetime.now;
        // check for dupes/missing entry
        db.playtomic.playerchallenge_challenges.get({ filter: { publickey: challenge.publickey, _id: new objectid(options.challengeid) }, limit: 2}, function(error, challenges) {

            if (error) {
                return callback("unable to update challenge (api.playerchallenges.update:152)", errorcodes.GeneralError);
            }
			
            if(challenges && challenges.length > 1 || challenges.length == 0) {
                return callback("challenge not found, cannot update", errorcodes.GeneralError, clean(challenges, options.data === true)[0]);
            }
			
            db.playtomic.playerchallenge_challenges.update({filter: { publickey: challenge.publickey, _id: new objectid(options.challengeid) },doc: {"$set": challenge}, safe: true}, function(error, challenge) {
                if (error) {
                    return callback("unable to update challenge (api.playerchallenges.update:161)", errorcodes.GeneralError);
                }
                return callback(null, errorcodes.NoError, clean([challenge], true)[0]);
            });
        });
    },
	
	getreplay: function(options,callback) {
		//find and return relevant replay data here
		var query = {
			filter: {
				publickey: options.publickey,
				_id: new objectid(options.challengeid)
			},
			limit: 1
		};
		
		db.playtomic.playerchallenge_challenges.get(query, function(error,challenge) {
			if(error) {
				return callback("challenge not found", errorcode.GeneralError);
			}
			if(!challege.results[options.event].replay[options.retrieveid]) {
				//handle no replay here
			}
			var response = {};
			response.replay = challenge.results[options.eventid].replay[options.retrieveid];
			return callback(null,errorcodes.NoError,response);
		});
	},
	
	postresult: function(options, callback) {
		var query ={
			filter: {
				publickey: options.publickey,
				_id: options.challengeid
			}
		};
		
		db.playtomic.playerchallenge_challenges.get(query, function(error, challenge) {
			if(error) {
				return callback("challenge not found", errorcode.GeneralError);
			}
			challenge.results[options.eventid].racetimes[options.playerid] = options.result;
			challenge.results[options.eventid].replay[options.playerid] = options.replay;
			//put replay somewhere
			// handle whose turn stuff here
			
			
			db.playtomic.playerchallenge_challenges.update({filter: {publickey: challenge.publickey, _id: new objectid(challenge.challengeid)}, doc: {"$set": challenge}, safe: true}, function(error, challenge) {
				if(error) {
					return callback("challenge not found", errorcode.GeneralError);
				}
				
				return callback(null,errorcodes.NoError, clean([challenge],true)[0]);
			
			});
		});
	
	}
};

function clean(challenges, data) {

    for(var i=0; i<challenges.length; i++) {

        var challenge = challenges[i];

        for(var x in challenge) {
            if(typeof(challenge[x]) == "String") {
                challenge[x] = utils.unescape(challenge[x]);
            }
        }

        for(var x in challenge.fields) {
            if(typeof(challenge.fields[x]) == "String") {
                challenge.fields[x] = utils.unescape(challenge.fields[x]);
            }
        }
		for(var x in challenge.results) {
		 delete x.replay;
		}
		challenge.rdate = utils.friendlyDate(utils.fromTimestamp(challenge.date));
        delete challenge.hash;
		challenge.challengeid = challenge._id;
		delete challenge._id;
		//set this up to clear out replay data
//        if(data !== true) {
 //           delete challenge.results.replays;
   //     }
    }

    return challenges;
};
