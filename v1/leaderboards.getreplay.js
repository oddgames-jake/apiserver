var api = require(__dirname + "/../api"),
    output = require(__dirname + "/output.js"),
    errorcodes = api.errorcodes,
	testing = process.env.testing || false;

module.exports = function(payload, request, response, testcallback) {

    api.leaderboards.getreplay(payload, function(error, errorcode, score){

        if(error) {
            if(testcallback) {
                testcallback(error);
            }

            return output.terminate(payload, response, errorcode, error);
        }

        var r = output.end(payload, response, {scores: score}, errorcode);

        if(testing && testcallback) {
            testcallback(null, r);
        }
    });
};