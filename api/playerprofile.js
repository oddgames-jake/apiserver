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
var geoip = require('geoip-lite');
var playerprofile = module.exports = {


	ping: function(options, callback){
		var query = {
			filter: {
				publickey: options.publickey,
				playerid: options.playerid
				},
			limit: 1,
			cache: true,
			cachetime: 60
		};
		
		// could split this ip/timezone business off into another larger ping/update that runs once 
		// per sesion or when required
		var ip = "138.91.92.90";
		var geo = geoip.lookup(ip);
		
		// gives the approximate timezone of the player
		var iptimezone = Math.round(geo.ll[1]/15);
		
		var data = {timezone: iptimezone,
					lastping: datetime.now};
		console.log(datetime.now);
		db.playtomic.playerprofiles.update(
		{filter: {publickey: options.publickey, playerid: options.playerid},
		doc: {"$set": data},safe: true}, function(error,profile) {
		});
		
		//possibly add in a matchmaking bit here
		return callback(null,errorcodes.NoError);
	},
		
    load: function(options, callback) {

        if(!options.playerid) {
            return callback("unable to load player profile (api.playerprofile.load:55)", errorcodes.GeneralError);
        }

        var query = {

            filter: {
                publickey: options.publickey,
				playerid: options.playerid
            },

            limit: 1,
            skip: 0,
            sort: {},
            cache: true,
            cachetime: 120
        };

        db.playtomic.playerpprofiles.get(query, function(error, challenges){
            
            if (error) {
                return callback("error loading profile (api.playerprofile.load:37)", errorcodes.GeneralError);
            }

            if (!challenges || challenges.length == 0) {
                return callback("unable to find challenge (api.playerprofile.load:41)", errorcodes.GeneralError);
            }

            return callback(null, errorcodes.NoError, clean(challenges, true)[0]);
        });
    },

	update: function(options, callback) {
		
        // small cleanup
        var playerprofile = {};

        // fields that just aren't relevant, by doing it this way it's easier to extend because you can
        // just add more fields directly in your game and they will end up in your scores and returned
        // to your game
        var exclude = ["section", "action", "ip", "date", "url", "page", "perpage", "filters", "debug"];
        
        // check for dupes/missing entry
        db.playtomic.playerpprofiles.get({ filter: { publickey: playerprofile.publickey, profileid: options.profileid }, limit: 2}, function(error, profiles) {

            if (error) {
                return callback("unable to update profile (api.playerprofile.update:71)", errorcodes.GeneralError);
            }
			
            if(profiles && profiles.length > 1 || profiles.length == 0) {
                return callback("profile not found, cannot update", errorcodes.GeneralError, clean(profiles)[0]);
            }
			
			// load up player profile
			playerprofile = profiles[0];
			
			// save over any data received
			for(var x in options) {
			
				if(exclude.indexOf(x) > -1) {
					continue;
				}

            playerprofile[x] = options[x];
			}
			
            db.playtomic.playerpprofiles.update({filter: { publickey: playerprofile.publickey, profileid: playerprofile.profileid },doc: {"$set" : playerprofile}, safe: true}, function(error, playerprofile) {
                if (error) {
                    return callback("unable to update player profile (api.playerprofile.update:87)", errorcodes.GeneralError);
                }
                return callback(null, errorcodes.NoError, clean([playerprofile])[0]);
            });
        });
    },
	
	create: function(options,callback) {
	if(!options.playerid){
		return callback("unable to create profile, no ID supplied (api.playerprofile.update:93)", 1001);
	}

	console.log("Creating player: ",options.playerid);
	db.playtomic.playerprofiles.get({ filter: { publickey: options.publickey, playerid: options.playerid }, limit: 1}, function(error, profiles) {
		if(profiles.length != 0 || error){
			return callback("unable to create profile, ID already exists", 1002);
		}
	
	
		// fields that just aren't relevant, by doing it this way it's easier to extend because you can
        // just add more fields directly in your game and they will end up in your scores and returned
        // to your game
        var exclude = ["section", "action", "ip", "date", "url", "page", "perpage", "filters", "debug"];
		var playerprofile = {};
		for(var x in options) {
			
				if(exclude.indexOf(x) > -1) {
					continue;
				}

            playerprofile[x] = options[x];
		}
		
		db.playtomic.playerprofiles.insert({doc: playerprofile, safe: true}, function(error, playerprofile) {
			if (error) {
                    return callback("unable to save profile (api.playerprofiles.save:118)", 1003);
                }
			//console.log("succesfully inserted player into db");
            return callback(null, errorcodes.NoError, clean([playerprofile])[0]);
		});
	});
	}
};

function clean(profiles) {

    for(var i=0; i<profiles.length; i++) {

        var profile = profiles[i];

        for(var x in profile) {
            if(typeof(profile[x]) == "String") {
                profile[x] = utils.unescape(profile[x]);
            }
        }

        for(var x in profile.fields) {
            if(typeof(profile.fields[x]) == "String") {
                profile.fields[x] = utils.unescape(profile.fields[x]);
            }
        }

		profile.rdate = utils.friendlyDate(utils.fromTimestamp(profile.date));
        delete profile.hash;
		delete profile._id;
    }

    return profiles;
};
