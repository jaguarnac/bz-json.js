var BugzillaClient = function (options) {
    options = options || {};
    this.username = options.username;
    this.password = options.password;
    this.apiUrl = options.url || "https://bugzilla.mozilla.org/jsonrpc.cgi";
}

BugzillaClient.prototype = {
    getBug: function (id, params, callback) {
        if (!callback) {
            callback = params;
            params = {};
        }
        this.APIRequest('Bug.bug', id, 'GET', callback, null, null, params);
    },

    APIRequest: function (method, id, requestMethod, callback, field, body, params) {
        var url = this.apiUrl;
        url += '?method=Bug.get&params=[{"ids":[' + id + ']}]';
        params = params || {};
        if (this.username && this.password) {
            params.username = this.username;
            params.password = this.password;
        }
        if (params) {
            url += '&' + this.urlEncode(params);
        }

        body = JSON.stringify(body);

        try {
            XMLHttpRequest = require("xhr").XMLHttpRequest; // Addon SDK
        }
        catch (e) { }

        var that = this;
        if (typeof XMLHttpRequest != "undefined") {
            // in a browser
            var req = new XMLHttpRequest();
            req.open(requestMethod, url, true);
            req.setRequestHeader("Accept", "application/json");
            if (requestMethod.toUpperCase() !== "GET") {
                req.setRequestHeader("Content-type", "application/json");
            }
            req.onreadystatechange = function (event) {
                if (req.readyState == 4) {
                    that.handleResponse(null, req, callback, field);
                }
            };
            req.send(body);
        }
        else {
            // node 'request' package
            require("request")({
                uri: url,
                method: requestMethod,
                body: body,
                headers: { 'Content-type': 'application/json' }
            },
              function (err, resp, body) {
                  that.handleResponse(err, {
                      status: resp && resp.statusCode,
                      responseText: body
                  }, callback, field);
              }
            );
        }
    },

    handleResponse: function (err, response, callback, field) {
        var error, json;
        if (err)
            error = err;
        else if (response.status >= 300 || response.status < 200)
            error = "HTTP status " + response.status;
        else {
            try {
                json = JSON.parse(response.responseText);
            } catch (e) {
                error = "Response wasn't valid json: '" + response.responseText + "'";
            }
        }
        if (json && json.error)
            error = json.error.message;
        var ret;
        if (!error) {
            ret = field ? json[field] : json;
            if (field == 'ref') {// creation returns API ref url with id of created object at end
                var match = ret.match(/(\d+)$/);
                ret = match ? parseInt(match[0]) : true;
            }
        }
        callback(error, ret);
    },

    urlEncode: function (params) {
        var url = [];
        for (var param in params) {
            var values = params[param];
            if (!values.forEach)
                values = [values];
            // expand any arrays
            values.forEach(function (value) {
                url.push(encodeURIComponent(param) + "=" +
                  encodeURIComponent(value));
            });
        }
        return url.join("&");
    }
}

exports.createClient = function (options) {
    return new BugzillaClient(options);
}