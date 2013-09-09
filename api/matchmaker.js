var config = require(__dirname + "/config.js"),
    db = require(__dirname + "/database.js"),
    mongodb = require("mongodb"),
    mdouble = mongodb.BSONPure.Double,
    objectid = mongodb.BSONPure.ObjectID,
    md5 = require(__dirname + "/md5.js"),
    utils = require(__dirname + "/utils.js"),
    date = utils.fromTimestamp,
    datetime = require(__dirname + "/datetime.js"),
    errorcodes = require(__dirname + "/errorcodes.js").errorcodes,
	dirty = require("dirty");
	

var startingup = true;

//loaded from mongodb
var lastpingoffsets = [60,1800,7200,14400,28800,86400,172800,259200,604800,1209600];
var elodeltas = [34,68,102,136,170,204,238,272,306,340];
var playtimedeltas = [1,2,3,4,5,6,7,8,9,10];
var responsetimedeltas = [0,1,1,2,2,3,3,4,4,5];

var matchmaker = module.exports = {
	
	find: function(payload,callback) {
	
		if(startingup == true ||!payload.playerid || !payload.elo || lastpingoffsets == undefined){// || !payload.responsetime || !payload.playtime) {
			return callback("unable to find match, insufficient data (api.matchmaker.find:16)",errorcodes.GeneralError);
		}
		
		var cntr = 0;
		var count =0;
		// the array of selected possible matches
		var returns = new Array();
		console.log("elo",payload.elo);
		//make a list of potential matches
		while(true) {
			dirty.forEach(function(key,val) {
			count++;
				if((datetime.now - val.lastping) <= lastpingoffsets[cntr] || true) {
					if(Math.abs(payload.playtime - val.playtime) <= playtimedeltas[cntr]) {
				 		if(Math.abs(payload.responsetime - val.responsetime) <= responsetimedeltas[cntr] ) {
							if(Math.abs(payload.elo - val.elo) <= elodeltas[cntr]) {
								//add to list
								returns.push(key);
								if(returns.length > 99) return false;//if enough exit the forEach
							}
						}
					}
				}
				else {
					//sorted by pingtime descending so one fails the rest will
					console.log("count: ",count,"when skipped");
					return false;
				}
			});
			cntr++;
			// if nothing found and at last iteration return first entrant in dirty db(most recent pinger)
			if(cntr > 9 && returns.length == 0){
				dirty.forEach( function(key,val){
					returns.push(key);
					return false;
				});
			}
			if(returns.length > 99 || cntr > 9)
				break;
		}
		console.log(count, "records, iterations: ", cntr, "returned", returns.length);
		var selected = 0;
		var minchallenge = 999;
		for(var i = 0; i < returns.length; i++){
			if(dirty.get(returns[i]).challengestoday < minchallenge) {
				selected = i;
				minchallenge = dirty.get(returns[i]).challengestoday;
			}
		}
		var selectedid = returns[selected];
		var otherdata = dirty.get(selectedid);
		
		dirty.rm(selectedid);
		if(otherdata == null) {
			return callback("unable to find challenge", errorcodes.NoChallengeFound);
		}
		console.log(otherdata.elo);
		// console.log(selectedid);
		// console.log(otherdata);
		// update playerprofile(playerid: entry) with new challenge sent
		var challenge = {};
		challenge.publickey = payload.publickey;
		challenge.playerids = [payload.playerid, selectedid];
		challenge.playernames = [payload.playername, otherdata.playername];
		
		db.playtomic.playerprofiles.update({filter: {playerid: selectedid}, 
			doc: {"$set" : {challengedtime: datetime.now}, "$inc" : {challengestoday: 1}}, 
			safe: true}, function (error, challenge) {
				// this space intentionally left blank
			});
			
			
		db.playtomic.playerchallenge_challenges.insert({doc: challenge, safe: true}, function (error,challenge) {
			if (error) {
					return callback("unable to save challenge", errorcodes.GeneralError);
				}
			return callback(null, errorcodes.NoError, clean([challenge], true)[0]);
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

		challenge.rdate = utils.friendlyDate(utils.fromTimestamp(challenge.date));
        delete challenge.hash;
		challenge.challengeid = challenge._id;
		delete challenge._id;

        if(data !== true) {
            delete challenge.data;
        }
    }

    return challenges;
};

(function() {

	var updateFreq = 10000;//ms
	var testpublickey = "testpublickey";
	var pingtime = 3600*24*14;//seconds
	var challengedelay = 600;//seconds
	var starthour = 9;
	var endhour = 21;
	var mintimeoffset = 0;
	var maxtimeoffset = 0;
	
	//Scrapes the mongodb for connected users who havent been challenged recently
	function refreshonline()
	{
		//get setup data from db		
		getData();
		
		//update timezone array		
		updatetimezonedata();
		
		//pull suitable records from mongodb
		var query = {
			filter: {
			publickey: testpublickey,
			lastping: {"$gte": (datetime.now - pingtime)},
			challengedtime: {"$lte": (datetime.now - challengedelay)}
			},
			sort: {lastping: -1} ,
		};
		
		//account for timezone wraparound
		if(mintimeoffset > maxtimeoffset) {
			query.filter["$or"] = [{timezone: {"$gte": mintimeoffset}},{timezone: {"$lte": maxtimeoffset}}]; 
		}
		else {
			query.filter["$and"] = [{timezone: {"$gte": mintimeoffset}},{timezone: {"$lte": maxtimeoffset}}]; 
		}
		
		db.playtomic.playerprofiles.get(query, function(error,profiles) {
			if(!error) {
			//console.log("search returned",profiles.length,"units");
			startingup = false;
				// reset dirty db here
				dirty = new require('dirty')();
				// put all found online players  in the dirty db
				for(var i = 0; i < profiles.length; i++)
				{
					dirty.set(profiles[i].playerid,{
					lastping: profiles[i].lastping,
					elo: profiles[i].elo, 
					playtime: profiles[i].playtime, 
					responsetime: profiles[i].responsetime,
					playername: profiles[i].playername,
					challengedtime: profiles[i].challengedtime,
					challengestoday: profiles[i].challengestoday
					});
				}
			}
			else{
				console.log(error);
			}
		});
		return setTimeout(refreshonline, updateFreq);
	}
	
	function getData()
	{
		var gamevars = new require("./gamevars.js");
		
		var data = gamevars.load("matchmakerdata");
		
		var testnull = data["lastpingoffsets"];		
		if(testnull != undefined) {
			
			lastpingoffsets = data["lastpingoffsets"];
			lastpingoffsets = lastpingoffsets["value"];
			
			elodeltas = data["elodeltas"];
			elodeltas = elodeltas["value"];
			
			playtimedeltas = data["playtimedeltas"];
			playtimedeltas = playtimedeltas["value"];
			
			responsetimedeltas = data["responsetimedeltas"];
			responsetimedeltas = responsetimedeltas["value"];
			
			updateFreq = data["updatefreq"];
			updateFreq = updateFreq["value"];
			
			challengedelay = data["challengedelay"];
			challengedelay = challengedelay["value"];
			
			pingtime = data["maxpingtime"];
			pingtime = pingtime["value"];
			
			starthour = data["starthour"];
			starthour = starthour["value"];
			
			endhour = data["endhour"];
			endhour = endhour["value"];
		}
	}
	
	function updatetimezonedata(){
		var d = new Date();
		var hour = d.getUTCHours();
		mintimeoffset = (starthour - 12) + (12 - hour);
		
		if(mintimeoffset < -12) {
			mintimeoffset =(14+(mintimeoffset + 12))
		}
		if(mintimeoffset > 14) {
			mintimeoffset = (-12 + (mintimeoffset - 14));
		}	
		
		maxtimeoffset = (endhour - 12) + (12 - hour);			
		
		if(maxtimeoffset < -12) {
			maxtimeoffset =(14+(maxtimeoffset + 12))
		}
		if(maxtimeoffset > 14) {
			maxtimeoffset = (-12 + (maxtimeoffset - 14));
		}
	}
	
	refreshonline();
}) ();