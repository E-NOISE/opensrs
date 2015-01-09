//
// Dependencies
//
var tls = require('tls');
var util = require('util');
var crypto = require('crypto');
var xml = require('node-xml');


var eol = '\r\n';
var rpc_handler_version = '0.9';
var rpc_handler_port = 55443;


var defaults = {
  user: null,
  key: null,
  sandbox: false
};


function isObject(obj) {
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
}


function extend(obj) {
  if (!isObject(obj)) return obj;
  var source, prop;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  for (var i = 1, length = arguments.length; i < length; i++) {
    source = arguments[i];
    for (prop in source) {
      if (hasOwnProperty.call(source, prop)) {
          obj[prop] = source[prop];
      }
    }
  }
  return obj;
}


function isNonEmptyObj(o) {
  var k, count = 0;
  if (typeof o !== 'object') { return false; }
  for (k in o) { if (o.hasOwnProperty(k)) { count++; } }
  return (count > 0);
}


function buildDataBlock(data) {
  var key, str = '';
  var tag = (util.isArray(data)) ? 'dt_array' : 'dt_assoc';

  str += '<' + tag + '>' + eol;

  for (key in data) {
    if (data.hasOwnProperty(key)) {
      if (util.isArray(data[key]) || isNonEmptyObj(data[key])) {
        str += '<item key="' + key + '">' + eol;
        str += buildDataBlock(data[key]);
        str += '</item>' + eol;
      } else if (data[key]) {
        str += '<item key="' + key + '">' + data[key] + '</item>' + eol;
      }
    }
  }

  str += '</' + tag + '>' + eol;
  return str;
}


function buildXmlPayload(obj, action, attr) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">',
    '<OPS_envelope>',
    '<header>',
    '<version>' + rpc_handler_version + '</version>',
    '</header>',
    '<body>',
    '<data_block>',
    buildDataBlock({
      protocol: 'XCP',
      object: obj,
      action: action,
      attributes: attr
    }),
    '</data_block>',
    '</body>',
    '</OPS_envelope>'
  ].join(eol);
}


function signRequest(xml, key) {
  var hash = crypto.createHash('md5'), tmp;
  hash.update(xml + key);
  tmp = hash.digest('hex');
  hash = crypto.createHash('md5');
  hash.update(tmp + key);
  return hash.digest('hex');
}


function buildRequest(host, user, key, xml) {
  return [
    'POST ' + host + ' HTTP/1.0',
    'Content-Type: text/xml',
    'X-Username: ' + user,
    'X-Signature: ' + signRequest(xml, key),
    'Content-Length: ' + xml.length,
    eol + xml
  ].join(eol);
}


//
// ### Parse XML response asynchronously
//
// #### Arguments
//
// * _String_ **responseXml** The XML string to be parsed.
// * _Function_ **cb** Callback invoked when parsing is finshed.
//   This function will have two arguments: an error object and the
//   parsed data. If successful the error object will be null.
//
function parseResponse(responseXml, cb) {
  var parser = new xml.SaxParser(function (p) {
    var res, parent, currentKey;

    p.onEndDocument(function () {
      cb(null, res);
    });

    p.onStartElementNS(function (elem, attrs) {
      switch (elem) {
      case 'dt_assoc':
        if (!res) {
          res = {};
        } else {
          res[currentKey] = {};
          parent = res;
          res = res[currentKey];
          res._parent = parent;
          currentKey = null;
        }
        break;
      case 'dt_array':
        res[currentKey] = [];
        parent = res;
        res = res[currentKey];
        res._parent = parent;
        currentKey = null;
        break;
      case 'item':
        currentKey = attrs[0][1];
        break;
      default:
        //console.log(elem);
        break;
      }
    });

    p.onEndElementNS(function (elem) {
      var isContainer = (elem === 'dt_assoc' || elem === 'dt_array');

      if (isContainer && res && res._parent) {
        parent = res._parent;
        delete res._parent;
        res = parent;
      }

      currentKey = null;
    });

    p.onCharacters(function (chars) {
      if (currentKey) {
        if (res.push) {
          res.push(chars);
        } else {
          switch (currentKey) {
          case 'response_code':
          case 'page':
          case 'remainder':
          case 'total':
          case 'balance':
          case 'hold_balance':
            chars = Number(chars);
            break;
          case 'is_success':
            chars = Boolean(chars);
            break;
          }

          res[currentKey] = chars;
        }
      }
    });

    p.onWarning(function (msg) { cb(msg); });
    p.onError(function (msg) { cb(msg); });
  });

  parser.parseString(responseXml);
}


module.exports = function (options) {

  var settings = extend({}, defaults, options);
  var host = (settings.sandbox) ? 'horizon.opensrs.net' : 'rr-n1-tor.opensrs.net';
  var activeRequests = 0;

  if (typeof settings.user !== 'string' || typeof settings.key !== 'string') {
    throw new TypeError('options.user and options.key must be strings');
  }

  //
  // ### Send API request.
  //
  // #### Arguments
  //
  // * _String_ **obj** The API object name, ie: 'balance', 'domain', ...
  // * _String_ **method** The API method, ie; 'get_balance', ...
  // * _Object_ **params** [Optional] An object containing parameters to be
  //   passed in the request.
  // * _Function_ **cb** Callback invoked when the response is complete.
  //   This function will have two arguments , an error object and the
  //   response data. If successful the error object will be null.
  //
  var client = function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var obj = args.shift();
    var method = args.shift();
    var cb = args.pop() || function () {};
    var params = args.shift();
    var xml = buildXmlPayload(obj, method, params);
    var request = buildRequest(host, settings.user, settings.key, xml);
    var responseRaw = '';

    function done(err, data) {
      activeRequests--;
      cb(err, data);
    }

    activeRequests++;
    var stream = tls.connect(rpc_handler_port, host, function () {
      if (!stream || !stream.readable || !stream.writable) {
        return done(new Error('Could not connect to server ' + host +
                              ' on port ' + rpc_handler_port));
      }
      stream.write(request);
    })
      .on('error', function (err) { done(err); })
      .on('data', function (buf) { responseRaw += buf.toString(); })
      .on('end', function () {
        var lines = responseRaw.split('\n');
        var flag = false, i, responseXml = '';

        for (i = 0; i < lines.length; i++) {
          if (flag) {
            responseXml += lines[i] + '\n';
          } else if (/^<\?xml/.test(lines[i].trim())) {
            flag = true;
            i--;
          } else if (lines[i].trim() === '') {
            flag = true;
          }
        }

        if (responseXml === '') { return done(null, ''); }

        parseResponse(responseXml, function (err, res) {
          if (err) {
            done(err, null);
          } else if (!res.is_success) {
            done(res, null);
          } else {
            // remove redundant properties
            delete res.protocol;
            delete res.action;
            delete res.object;
            done(null, res);
          }
        });
      });
  };

  client._activeRequests = function () { return activeRequests; };

  return client;

};


// Export `parseResponse` for testing
module.exports._parseResponse = parseResponse;

