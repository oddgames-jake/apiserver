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

//performance tracking

//how many times the loop reset and widened scope in search
var loops = new Array();
loops[0] = 0;
loops[1] = 0;

var matchmaker = module.exports = {
	
	//challenges a random player of similar quality who has been online recently
	find: function(payload,callback) {
	
		if(startingup == true ||!payload.playerid || !payload.elo || lastpingoffsets == undefined)// || !payload.responsetime || !payload.playtime) {
			return callback("unable to find match, insufficient data (api.matchmaker.find)",errorcodes.GeneralError);
		
		var cntr = 0;
		// the array of selected possible matches
		var returns = new Array();
		
		//make a list of potential matches
		while(true) {
			dirty.forEach(function(key,val) {
            // Disable || true in production
				if((datetime.now - val.lastping) <= lastpingoffsets[cntr] || true) {
					if(Math.abs(payload.playtime - val.playtime) <= playtimedeltas[cntr]) {
				 		if(Math.abs(payload.responsetime - val.responsetime) <= responsetimedeltas[cntr] ) {
							if(Math.abs(payload.elo - val.elo) <= elodeltas[cntr]) {

								returns.push(key);
								if(returns.length > 99) return false;//if enough exit the forEach
							}
						}
					}
				}
				else {
					//sorted by pingtime descending so when an item fails the first check the rest will as well
					return false;
				}
			});
			cntr++;
			// if nothing found and by last iteration return first entrant in dirty db(most recent pinger)
			if(cntr > 9 && returns.length == 0) {
            
				dirty.forEach( function(key,val) {
					returns.push(key);
					return false;
				});
			}
			if(returns.length > 99 || cntr > 9)
				break;
		}
		
		loops[0]++;
		loops[1] += cntr;
		
		var selected = -1;
		var minchallenge = 999;
		var exists = false;
		for(var i = 0; i < returns.length; i++) {
		
			exists = false;
            
			if(returns[i] == payload.playerid) {
				exists = true;
				continue;
            }
            
			for(var x =0; x < payload.blockedids.length; x++) {

				if(returns[i] == payload.blockedids[x]){
					exists = true;
                    break;
				}
			}
            
			if(exists == true) 
                continue;
                
			if(dirty.get(returns[i]).challengestoday < minchallenge) {
				selected = i;
				minchallenge = dirty.get(returns[i]).challengestoday;
			}
		}
		
		var otherdata = null;
		if(selected != -1) {
			var selectedid = returns[selected];
			otherdata = dirty.get(selectedid);
			dirty.rm(selectedid);
		}
		
		if(otherdata == null) {
			return callback("unable to find challenge", errorcodes.NoChallengeFound);
		}
		
		// make the playerchallenge entry
		var challenge = {};
		challenge.publickey = payload.publickey;
		challenge.playerids = [payload.playerid, selectedid];
		challenge.hide = true;
		challenge.playerinfo = { };
		challenge.playerinfo[payload.playerid] = {name: payload.playername, myturn: true, hasseenchallenge: true};
		challenge.playerinfo[selectedid] = {name: otherdata.playername, myturn: false, hasseenchallenge: false};
		challenge.currentturn = 0;
		challenge.idle = true;
		challenge.date = datetime.now;
		challenge.startdate = challenge.date;
		
		
		db.playtomic.playerprofiles.update({filter: {playerid: selectedid}, 
			doc: {"$set" : {challengedtime: datetime.now}, "$inc" : {challengestoday: 1}}, 
			safe: true}, function (error, challenge) {
				// this space intentionally left blank
			});
			
			
		db.playtomic.playerchallenge_challenges.insert({doc: challenge, safe: true}, function (error,challenge) {
			if (error) 
				return callback("unable to save challenge", errorcodes.GeneralError);
                
			return callback(null, errorcodes.NoError, clean([challenge], true)[0]);
		});
	},
	
	// TODO: Implement me
	// Matchmakes groups of players, for  team based or > 2 player matches
	// findmulti: function(payload, callback) {
	
	// }
};

function clean(challenges, data) {

    for(var i = 0; i < challenges.length; i++) {

        var challenge = challenges[i];

        for(var x in challenge) {
            if(typeof(challenge[x]) == "String") 
            
                challenge[x] = utils.unescape(challenge[x]);
        }

        for(var x in challenge.fields) {
        
            if(typeof(challenge.fields[x]) == "String")
                challenge.fields[x] = utils.unescape(challenge.fields[x]);
        }

		challenge.rdate = utils.friendlyDate(utils.fromTimestamp(challenge.date));
        delete challenge.hash;
		challenge.challengeid = challenge._id;
		delete challenge._id;

        if(data !== true)
            delete challenge.data;
    }

    return challenges;
};

(function() {

	var testpublickey = "testpublickey";
    
	//setting vars, these values only used until gamevars is loaded
	var updateFreq = 10;                    // How often to refresh lists/settings (seconds)
	var pingtime = 3600 * 24 * 14;          // max time since last ping (seconds)
	var challengedelay = 18000;             //minimum delay between being challenged
	var starthour = 9;                      //earliest hour (in players local time) to add to potential matches list
	var endhour = 21;                       //latest hour(in players local time) to add to potential matches list
    
    // calc vars
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
			fields: {
			_id: false,
			playerid: true,
			lastping: true,
			elo: true,
			playtime: true,
			responsetime: true,
			playername: true,
			challengedtime: true,
			challengestoday: true			
			},
			sort: {lastping: -1} ,
			limit: 10000
		};
		
		// //account for timezone wraparound
		if(mintimeoffset >= maxtimeoffset) {
			query.filter["$or"] = [{timezone: {"$gte": mintimeoffset}},{timezone: {"$lte": maxtimeoffset}}]; 
		}
		else {
			query.filter["$and"] = [{timezone: {"$gte": mintimeoffset}},{timezone: {"$lte": maxtimeoffset}}]; 
		}
		
		db.playtomic.playerprofiles.get(query, function(error,profiles) {
			if(!error) {
			
                startingup = false;
				// reset dirty db here
				dirty = new require('dirty')();
				// put all found online players  in the dirty db
				for(var i = 0; i < profiles.length; i++) {
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
		});
        
		return setTimeout(refreshonline, updateFreq * 1000);
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
        
		mintimeoffset = (starthour - hour);		
        
		if(mintimeoffset < -12) 
			mintimeoffset = mintimeoffset + 24;
            
		if(mintimeoffset > 12) 
			mintimeoffset =  mintimeoffset - 24;	
		
		maxtimeoffset = (endhour - hour);
		if(maxtimeoffset < -12)
			maxtimeoffset = maxtimeoffset + 24;

		if(maxtimeoffset > 12) 
			maxtimeoffset = maxtimeoffset - 24;

	}
	
	refreshonline();
	
	// runs every hour at midnight server localtime
	function DailyUpdater() {
		// make stats log here
	}
	
	function HourlyUpdater() {
		// check for daily updater
		if(new Date().getHours() == 0)
			DailyUpdater();
			
			
		// update daily challenge count for each player
		var currtimezone = new Date().getUTCHours();
		if(currtimezone > 12) currtimezone -= 24;
		var timearray = new Array();
		timearray.push(currtimezone);
		if(currtimezone == 12)
			timearray.push(-12);
		
		var command = {
	        filter: {
				timezone: {"$in": timearray}
            },
            doc: {
                $set: {challengestoday: 0}
            },
            upsert: false,
            safe: true,
			multi: true
		};
		
		db.playtomic.playerprofiles.update(command,function(error) {	
		toHour = (60 - new Date().getMinutes()) * 60000 + 1000;
		setTimeout(HourlyUpdater,toHour);
		});
	}
	
	var toHour = (60 - new Date().getMinutes()) * 60000 + 1000;
	setTimeout(HourlyUpdater,5000);
}) ();