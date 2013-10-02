var api = require(__dirname + "/../api"),
    output = require(__dirname + "/output.js"),
    errorcodes= require(__dirname + "/../api/errorcodes.js"),
	testing = process.env.testing || false;

module.exports = function(payload, request, response, testcallback) {

    api.playerprofiles.update(payload, function(error, errorcode, profile){

        if(error) {
            if(testcallback) {
                testcallback(error);
            }

            return output.terminate(payload, response, errorcode, error);
        }

        var r = output.end(payload, response, { profile: profile }, errorcode);

        if(testing && testcallback) {
            testcallback(null, r);
        }
    });
};