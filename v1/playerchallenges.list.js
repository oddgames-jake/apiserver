var api = require(__dirname + "/../api"),
    output = require(__dirname + "/output.js"),
    errorcodes = api.errorcodes,
	testing = process.env.testing || false;
	

module.exports = function(payload, request, response, testcallback) {

    api.playerchallenges.list(payload, function(error, errorcode, numchallenges, challenges) {

        if(error) {
            if(testcallback) {
                testcallback(error);
            }

            return output.terminate(payload, response, errorcode, error);
        }

        var r = output.end(payload, response, {challenges: challenges, numchallenges: numchallenges}, errorcodes.NoError);

        if(testing && testcallback) {
            testcallback(null, r);
        }
    });
};