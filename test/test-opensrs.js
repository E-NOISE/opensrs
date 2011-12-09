var
  vows = require('vows'),
  assert = require('assert'),
  fs = require('fs'),
  options = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8')),
  createClient = function (options) {
    return require('../lib/opensrs').createClient(options)
  };

// Create a Test Suite
vows.describe('OpenSRS reseller API client').addBatch({
  'parse bad XML response': {
    topic: function () {
      var
        client = createClient(options),
        xml = '<i><am><broken</i>';

      client.parseResponse(xml, this.callback);
    },
    'error is returned': function (er, res) {
      assert.ok(er);
      assert.ok(!res);
    }
  },
  'parse a balance get_balance XML response': {
    topic: function () {
      var
        client = createClient(options),
        xml = '<?xml version=\'1.0\' encoding="UTF-8" standalone="no" ?>' +
'<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">' +
'<OPS_envelope>' +
' <header>' +
'  <version>0.9</version>' +
'  </header>' +
' <body>' +
'  <data_block>' +
'   <dt_assoc>' +
'    <item key="protocol">XCP</item>' +
'    <item key="object">BALANCE</item>' +
'    <item key="response_text">Command successful</item>' +
'    <item key="action">REPLY</item>' +
'    <item key="attributes">' +
'     <dt_assoc>' +
'      <item key="balance">215.14</item>' +
'      <item key="hold_balance">10.34</item>' +
'     </dt_assoc>' +
'    </item>' +
'    <item key="response_code">200</item>' +
'    <item key="is_success">1</item>' +
'   </dt_assoc>' +
'  </data_block>' +
' </body>' +
'</OPS_envelope>';

      client.parseResponse(xml, this.callback);
    },
    'we get a nice object': function (er, obj) {
      assert.ok(!er);
      assert.ok(obj);
      assert.ok(obj.protocol && obj.protocol === 'XCP');
      assert.ok(obj.object && obj.object === 'BALANCE');
      assert.ok(obj.response_text && obj.response_text === 'Command successful');
      assert.ok(obj.action && obj.action === 'REPLY');
      assert.ok(obj.response_code && obj.response_code === 200);
      assert.ok(obj.is_success && obj.is_success === true);
      assert.ok(obj.attributes && typeof obj.attributes === 'object');
      assert.ok(obj.attributes.balance && obj.attributes.balance === 215.14);
      assert.ok(obj.attributes.hold_balance && obj.attributes.hold_balance === 10.34);
    }
  },
  'parse a domain get_domains_by_expiredate XML response': {
    topic: function () {
      var
        client = createClient(options),
        xml = '<?xml version=\'1.0\' encoding="UTF-8" standalone="no" ?>' +
'<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">' +
'<OPS_envelope>' +
' <header>' +
'  <version>0.9</version>' +
'  </header>' +
' <body>' +
'  <data_block>' +
'   <dt_assoc>' +
'    <item key="protocol">XCP</item>' +
'    <item key="object">DOMAIN</item>' +
'    <item key="response_text">Command successful</item>' +
'    <item key="action">REPLY</item>' +
'    <item key="attributes">' +
'     <dt_assoc>' +
'      <item key="exp_domains">' +
'       <dt_array>' +
'        <item key="0">' +
'         <dt_assoc>' +
'          <item key="f_let_expire">Y</item>' +
'          <item key="name">pm-online-solutions.org</item>' +
'          <item key="expiredate">2011-03-12 11:21:07</item>' +
'          <item key="f_auto_renew">N</item>' +
'         </dt_assoc>' +
'        </item>' +
'        <item key="1">' +
'         <dt_assoc>' +
'          <item key="f_let_expire">Y</item>' +
'          <item key="name">lansons-evolve.com</item>' +
'          <item key="expiredate">2011-03-12 14:35:08</item>' +
'          <item key="f_auto_renew">N</item>' +
'         </dt_assoc>' +
'        </item>' +
'        <item key="2">' +
'         <dt_assoc>' +
'          <item key="f_let_expire">Y</item>' +
'          <item key="name">woodgrangerovers.co.uk</item>' +
'          <item key="expiredate">2011-03-12 15:20:08</item>' +
'          <item key="f_auto_renew">N</item>' +
'         </dt_assoc>' +
'        </item>' +
'       </dt_array>' +
'      </item>' +
'      <item key="page">1</item>' +
'      <item key="remainder">1</item>' +
'      <item key="total">25</item>' +
'     </dt_assoc>' +
'    </item>' +
'    <item key="response_code">200</item>' +
'    <item key="is_success">1</item>' +
'   </dt_assoc>' +
'  </data_block>' +
' </body>' +
'</OPS_envelope>';

        client.parseResponse(xml, this.callback);
    },
    'we get a pretty object with a lovely array in it': function (er, obj) {
      assert.ok(obj.protocol && obj.protocol === 'XCP');
      assert.ok(obj.object && obj.object === 'DOMAIN');
      assert.ok(obj.response_text && obj.response_text === 'Command successful');
      assert.ok(obj.action && obj.action === 'REPLY');
      assert.ok(obj.response_code && obj.response_code === 200);
      assert.ok(obj.is_success && obj.is_success === true);
      assert.ok(obj.attributes && typeof obj.attributes === 'object');
      assert.ok(obj.attributes.page === 1);
      assert.ok(obj.attributes.remainder === 1);
      assert.ok(obj.attributes.total === 25);
      assert.ok(obj.attributes.exp_domains);
      assert.ok(obj.attributes.exp_domains.length > 0);
      assert.ok(obj.attributes.exp_domains[0].hasOwnProperty('name'));
      assert.ok(obj.attributes.exp_domains[0].hasOwnProperty('expiredate'));
      assert.ok(obj.attributes.exp_domains[0].hasOwnProperty('f_let_expire'));
      assert.ok(obj.attributes.exp_domains[0].hasOwnProperty('f_auto_renew'));
    }
  },
  'on connect event': {
    topic: function () {
      var self = this, client = createClient(options);

      client.on('connect', function (server) {
        self.callback(null, server);
      });

      client.send('balance', 'get_balance', function () {});
    },
    'we get server info': function (er, server) {
      assert.ok(server.host);
      assert.ok(server.port);
    }
  },
  'on request event': {
    topic: function () {
      var self = this, client = createClient(options);

      client.on('request', function (req) {
        self.callback(null, req);
      });

      client.send('balance', 'get_balance', function () {});
    },
    'we get raw request text': function (er, req) {
      assert.ok(/^POST/.test(req));
      assert.ok(/OPS_envelope/.test(req));
    }
  },
  'on response event': {},
  'balance' : {
    topic: function () {
      var client = createClient(options);

      client.send('balance', 'get_balance', this.callback);
    },
    'we get balance and hold_balance': function (er, data) {
      assert.ok(!er);
      assert.ok(data);
      assert.ok(data.response_text && data.response_text == 'Command successful');
      assert.ok(data.is_success && data.is_success == 1);
      assert.ok(data.attributes && typeof data.attributes === 'object');
      assert.ok(data.attributes.balance);
      //assert.ok(data.attributes.hold_balance);
    }
  }
}).export(module);
