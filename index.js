// This is a server side JavaScript implementation of a client for the OpenSRS
// reseller's XML API.
//
// More info here:
// [OpenSRS XML API](http://www.opensrs.com/docs/opensrs_xmlapi.pdf)
//
// Author: Lupo Montero <lupo@e-noise.com>

// Dependencies and module's globals

var
  Stream = require('stream'),
  tls = require('tls'),
  crypto = require('crypto'),
  xml = require('node-xml'),
  _ = require('underscore'),
  rpc_handler_version = '0.9',
  rpc_handler_port = 55443,
  host = function (testMode) {
    if (testMode) { return 'horizon.opensrs.net'; }
    return 'rr-n1-tor.opensrs.net';
  },
  defaults = {
    user: null,
    key: null,
    test_mode: false
  };

// ## Private functions
/*{{{*/

function isNonEmptyObj(o) {
  var k, count = 0;
  if (typeof o !== 'object') { return false; }
  for (k in o) { if (o.hasOwnProperty(k)) { count++; } }
  return (count > 0);
}

function createResponse() {
  var s = new Stream();
  s.readable = true;
  return s;
}

function buildDataBlock(data) {
  var key, str = '', tag = (_.isArray(data)) ? 'dt_array' : 'dt_assoc';

  str += '<' + tag + '>\r\n';

  for (key in data) {
    if (data.hasOwnProperty(key)) {
      if (_.isArray(data[key]) || isNonEmptyObj(data[key])) {
        str += '<item key="' + key + '">\r\n';
        str += buildDataBlock(data[key]);
        str += '</item>\r\n';
      } else if (data[key]) {
        str += '<item key="' + key + '">' + data[key] + '</item>\r\n';
      }
    }
  }

  str += '</' + tag + '>\r\n';
  return str;
}

function buildXmlPayload(obj, action, attr) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\r\n';
  xml += '<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">\r\n';
  xml += '<OPS_envelope>\r\n';
  xml += '<header>\r\n';
  xml += '<version>' + rpc_handler_version + '</version>\r\n';
  xml += '</header>\r\n';
  xml += '<body>\r\n';
  xml += '<data_block>\r\n';
  xml += buildDataBlock({ protocol: 'XCP', object: obj, action: action, attributes: attr });
  xml += '</data_block>\r\n';
  xml += '</body>\r\n';
  xml += '</OPS_envelope>\r\n';
  return xml;
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
    xml
  ].join('\r\n');
}

/*}}}*/

// ## OpenSRS Client Object

/*{{{*/

// ### OpenSRS client constructor.
//
// #### Arguments
// * _Object_ **options**
var OpenSRS = function (options) {
  this.options = _.extend({}, defaults, options);
  this._activeRequests = 0;
};

// ### Send API request.
//
// #### Arguments
// * _String_ **obj** The API object name, ie: 'balance', 'domain', ...
// * _String_ **method** The API method, ie; 'get_balance', ...
// * _Object_ **params** [Optional] An object containing parameter/attributes
//   to be passed in the request.
// * _Function_ **cb** Callback function invoked when the response is complete.
//   This function will have two arguments passed to it, an error object and the
//   response data. If successful the error object will be null.
OpenSRS.prototype.req = function () {
  var
    self = this,
    args = Array.prototype.slice.call(arguments, 0),
    obj = args.shift(),
    method = args.shift(),
    cb = args.pop() || function () {},
    params = args.shift(),
    hostname = host(self.options.test_mode),
    xml = buildXmlPayload(obj, method, params),
    request = buildRequest(hostname, self.options.user, self.options.key, xml),
    rs = createResponse(),
    stream, responseRaw = '';

  function done(err, data) {
    self._activeRequests--;
    if (err) {
      rs.emit('error', err);
    } else {
      rs.emit('data', data);
    }
    rs.emit('end');
    cb(err, data);
  }

  self._activeRequests++;
  stream = tls.connect(rpc_handler_port, hostname, function () {
    if (!stream || !stream.readable || !stream.writable) {
      return done(new Error('Could not connect to server ' + hostname +
                            ' on port ' + rpc_handler_port));
    }
    stream.write(request);
  })
    .on('error', function (err) { done(err); })
    .on('data', function (buf) { responseRaw += buf.toString(); })
    .on('end', function () {
      var
        lines = responseRaw.split('\n'),
        flag = false, i, responseXml = '';

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

      self.parseResponse(responseXml, function (err, res) {
        if (err) {
          done(err, null);
        } else if (!res.is_success) {
          done(res, null);
        } else {
          // remove redundant properties
          delete res.protocol;
          delete res.action;
          delete res.object;
          delete res.response_code;
          done(null, res);
        }
      });
    });

  return rs;
};

// ### Parse XML response asynchronously
//
// #### Arguments
// * _String_ **responseXml** The XML string to be parsed.
// * _Function_ **cb** Callback function to be invoked when parsing is finshed.
//   This function will have two arguments passed to it: an error object and the
//   parsed data. If successful the error object will be null.
OpenSRS.prototype.parseResponse = function (responseXml, cb) {
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
};

/*}}}*/

module.exports = function (options) {
  return new OpenSRS(options);
};
