var games = require(__dirname + "/../api/games.js"),
    playerchallenges = require(__dirname + "/../api/playerchallenges.js"),
    database = require(__dirname + "/../api/database.js"),
    assert = require("assert"),
    testgame = require(__dirname + "/testgame.js"),
    errorcodes = require(__dirname + "/../api/errorcodes.js").errorcodes,
    v1 = require(__dirname + "/../v1/playerchallenges.js");

describe("playerchallenges", function() {
	
    beforeEach(function(done) {

		// wait for db setup to complete
		function dbready() {
			if(!db.ready) {
				return setTimeout(dbready, 100);
			}
			
			done();
		}
		
		dbready();
    });

    var challenge;
	
   	 it("Save challenges", function(done) {

        var payload = {
            publickey: testgame.publickey,
            global: true,
			challengeid: Math.random(),
            playeraid: Math.random(),
            playeraname: "ben " + Math.random(),
			playerbid: Math.random(),
            playerbname: "ben " + Math.random(),
            fields: {},
            data: "sample data" // the challenge data
        };
		
        v1.save(payload, testgame.request, testgame.response, function(error, output) {

            assert.equal(error, null);
            assert.notEqual(output, null);

            var json;

            try {
                json = JSON.parse(output);
            } catch(s) {

            }

            assert.notEqual(json, null);
            assert.equal(json.errorcode, 0);
            assert.equal(json.success, true);
            assert.notEqual(json.challenge.challengeid, null);
            assert.equal(json.challenge.data, "sample data");
            challenge = json.challenge;
            // make sure we can't re-save with the same info
            v1.save(payload, testgame.request, testgame.response, function(error, output) {

                assert.notEqual(output, null);

                var json;

                try {
                    json = JSON.parse(output);
                } catch(s) {
                }

                assert.equal(json.errorcode, errorcodes.LevelAlreadyExists);


                done();
            });
        });
    });
	
    it("Load a challenge", function(done) {
        var payload = {
            publickey: testgame.publickey,
            challengeid: challenge.challengeid
        };
        v1.load(payload, testgame.request, testgame.response, function(error, output) {

            assert.equal(error, null);
            assert.notEqual(output, null);

            var json;

            try {
                json = JSON.parse(output);
            } catch(s) {

            }

            assert.notEqual(json, null);

            for(var x in challenge) {
                if(x == "fields") {
                    continue;
                }

                assert.equal(json.challenge[x], challenge[x]);
            }

            for(var x in challenge.fields) {
                assert.equal(json.challenge.fields[x], challenge.fields[x]);
            }

            done();
        });
    });
	
		it("Update a challenge", function(done){
			var payload ={
			publickey: testgame.publickey,
			challengeid: challenge.challengeid,
            playeraname: "bob " + Math.random(),
			playeraid: challenge.playeraid,
			playerbid: challenge.playerbid,
            playerbname: "bob " + Math.random(),
            fields: {},
            data: "sample data" // the challenge data
			};
			
			v1.update(payload, testgame.request, testgame.response, function(error, output) {
				assert.equal(error,null);
				done();
				});
		});
	
	it("List a players current challenges", function(done) {
        var payload = {
            publickey: testgame.publickey,
            playerid: challenge.playerbid
        };

        v1.list(payload, testgame.request, testgame.response, function(error, output) {

            assert.equal(error, null);
            assert.notEqual(output, null);

            var json;

            try {
                json = JSON.parse(output);
            } catch(s) {

            }
			
            assert.notEqual(json, null);

            done();
        });
    });
	
});