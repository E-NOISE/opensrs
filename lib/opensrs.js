/**
 * This is a server side JavaScript implementation of a client for the OpenSRS
 * reseller's XML API.
 *
 * More info here: http://www.opensrs.com/docs/opensrs_xmlapi.pdf
 */

var
  events = require('events'),
  tls = require('tls'),
  crypto = require('crypto'),
  xml = require('node-xml'),
  rpc_handler_version = '0.9',
  rpc_handler_port = 55443,
  host = 'rr-n1-tor.opensrs.net',
  endl = '\r\n';

/****************************** PRIVATE FUNCTIONS *****************************/

/*{{{*/

var buildXmlPayload = function (obj, action, attr) {
  var
    xml = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\r\n',
    buildDataBlock = function (data) {
      var
        str = '',
        isArray = function (a) {
          return (a.push && typeof a.push === 'function');
        },
        isNonEmptyObj = function (o) {
          var count = 0;

          if (typeof o !== 'object') return false;

          for (var k in o) if (o.hasOwnProperty(k)) count++;

          return (count > 0);
        },
        tag = (isArray(data)) ? 'dt_array' : 'dt_assoc';

      str += '<' + tag + '>\r\n';

      for (var key in data) {
        if (!data[key]) { continue; }

        if (isArray(data[key]) || isNonEmptyObj(data[key])) {
          str += '<item key="' + key + '">\r\n';
          str += buildDataBlock(data[key]);
          str += '</item>\r\n';
        } else {
          str += '<item key="' + key + '">' + data[key] + '</item>\r\n';
        }
      }

      str += '</' + tag + '>\r\n';

      return str;
    };

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
};

var signRequest = function (xml, key) {
  var hash = crypto.createHash('md5'), tmp;

  hash.update(xml + key);
  tmp = hash.digest('hex');
  hash = crypto.createHash('md5');
  hash.update(tmp + key);
  return hash.digest('hex');
};

var buildRequest = function (user, key, xml) {
  var headers = 'POST ' + host + ' HTTP/1.0' + endl;

  headers += 'Content-Type: text/xml' + endl;
  headers += 'X-Username: ' + user + endl;
  headers += 'X-Signature: ' + signRequest(xml, key) + endl;
  headers += 'Content-Length: ' + xml.length + endl;

  return headers + endl + xml;
};

/*}}}*/

/**************************** OpenSRS Client Object ***************************/

/*{{{*/

/**
 * OpenSRS client constructor.
 *
 * @param object options
 *
 * @return object
 */
var OpenSRS = function (options) {
  var self = this;

  if (options.test_mode) {
    host = 'horizon.opensrs.net';
  }

  self.user = options.user;
  self.key = options.key;
  self.cookie = null;
  self['status'] = 'disconnected';
  self.stream = null;
  self.connect();

  events.EventEmitter.call(self);
};

// inherit events.EventEmitter
OpenSRS.super_ = events.EventEmitter;
OpenSRS.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: OpenSRS,
    enumerable: false
  }
});

OpenSRS.prototype.connect = function () {
  var self = this;

  self.stream = tls.connect(rpc_handler_port, host, function () {
    self['status'] = 'connected';
    self.emit('connect', { host: host, port: rpc_handler_port });
  });

  self.stream.on('close', function () {
    self['status'] = 'disconnected';
    // since upgrading to node 0.4.8 need to emit 'end' event manually to make
    // sure responses are handled
    self.stream.emit('end');
    // reconnect after the stream is closed
    // not sure why the stream is automatically closed after every request ???
    self.connect();
  });

  self.stream.on('error', function () {
    self['status'] = 'disconnected';
    console.log('stream threw error!');
  });
};

/**
 * Send API request.
 *
 * @param string   obj    The API object name, ie: 'balance', 'domain', ...
 * @param string   method The API method, ie; 'get_balance', ...
 * @param object   params [Optional] An object containing parameter/attributes
 *                        to be passed in the request.
 * @param function cb     Callback function invoked when the response is
 *                        complete. This function will have two arguments passed
 *                        to it, an error object and the response data. If
 *                        successful the error object will be null.
 *
 * @return void
 */
OpenSRS.prototype.send = function (obj, method, params, cb) {
  var self = this, xml, responseRaw = '';

  if (self['status'] !== 'connected') {
    setTimeout(function () { self.send(obj, method, params, cb); }, 25);
    return;
  }

  // set status to sending to avoid sending simultaneous requets
  self['status'] = 'sending';

  if (typeof params === 'function') {
    cb = params;
    params = null;
  }

  xml = buildXmlPayload(obj, method, params);
  request = buildRequest(self.user, self.key, xml);
  self.emit('request', request);

  self.stream.on('data', function (data) {
    responseRaw += data.toString();
  });

  self.stream.on('end', function () {
    var
      lines = responseRaw.split('\n'),
      flag = false,
      responseXml = '';

    self.emit('response', responseRaw);

    for (var i = 0; i < lines.length; i++) {
      if (flag) {
        responseXml += lines[i] + '\n';
      } else if (/^<\?xml/.test(lines[i].trim())) {
        flag = true;
        i--;
      } else if (lines[i].trim() === '') {
        flag = true;
      }
    }

    if (responseXml === '') {
      cb(null, '');
      return;
    }

    self.parseResponse(responseXml, function (er, res) {
      if (er) {
        cb(er, null);
      } else if (!res.is_success) {
        cb(res, null);
      } else {
        // remove redundant properties
        delete res.protocol;
        delete res.action;
        delete res.object;
        delete res.response_code;
        cb(null, res);
      }
    });
  });

  self.stream.write(request);
};

/**
 * Parse XML response asynchronously
 *
 * @param string   responseXml The XML string to be parsed.
 * @param function cb          Callback function to be invoked when parsing is
 *                             finshed. This function will have two arguments
 *                             passed to it: an error object and the parsed
 *                             data. If successful the error object will be
 *                             null.
 *
 * @return void
 */
OpenSRS.prototype.parseResponse = function (responseXml, cb) {
  var parser = new xml.SaxParser(function (p) {
    var res, parent, currentKey;

    p.onEndDocument(function() {
      cb(null, res);
    });

    p.onStartElementNS(function(elem, attrs) {
      switch (elem) {
      case 'dt_assoc' :
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

      case 'dt_array' :
        res[currentKey] = [];
        parent = res;
        res = res[currentKey];
        res._parent = parent;
        currentKey = null;
        break;

      case 'item' :
        currentKey = attrs[0][1];
        break;

      default :
        //console.log(elem);
        break;
      }
    });

    p.onEndElementNS(function(elem) {
      var isContainer = (elem === 'dt_assoc' || elem === 'dt_array');

      if (isContainer && res && res._parent) {
        parent = res._parent;
        delete res._parent;
        res = parent;
      }

      currentKey = null;
    });

    p.onCharacters(function(chars) {
      if (currentKey) {
        if (res.push) {
          res.push(chars);
        } else {
          switch (currentKey) {
          case 'response_code' :
          case 'page' :
          case 'remainder' :
          case 'total' :
          case 'balance' :
          case 'hold_balance' :
            chars = Number(chars);
            break;
          case 'is_success' :
            chars = Boolean(chars)
            break;
          }

          res[currentKey] = chars;
        }
      }
    });

    p.onWarning(function(msg) {
      cb(msg, null);
    });

    p.onError(function(msg) {
      cb(msg, null);
    });
  });

  parser.parseString(responseXml);
};

/*}}}*/

exports.createClient = function (options) {
  return new OpenSRS(options);
};
