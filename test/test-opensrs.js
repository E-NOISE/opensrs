var
  config = require('./config.json'),
  opensrs = require('../index');

// heper functions
function pad(n) { return (n < 10) ? '0' + n : n; }
function formatDate(d) {
  return [ d.getFullYear(), pad((d.getMonth() + 1)), pad(d.getDate()) ].join('-');
}

exports.parseBadXmlResponse = function (t) {
  var client = opensrs(config);
  client.parseResponse('<i><am><broken</i>', function (err, data) {
    t.ok(err);
    t.ok(!data);
    t.done();
  });
};

exports.parseABalanceXmlResponse = function (t) {
  var
    client = opensrs(config),
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

  client.parseResponse(xml, function (err, data) {
    t.ok(!err);
    t.ok(data);
    t.equal(data.protocol, 'XCP');
    t.equal(data.object, 'BALANCE');
    t.equal(data.response_text, 'Command successful');
    t.equal(data.action, 'REPLY');
    t.equal(data.response_code, 200);
    t.equal(data.is_success, true);
    t.equal(typeof data.attributes, 'object');
    t.equal(data.attributes.balance, 215.14);
    t.equal(data.attributes.hold_balance, 10.34);
    t.done();
  });
};

exports.parseDomainsByExpireDateResponse = function (t) {
  var
    client = opensrs(config),
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

  client.parseResponse(xml, function (err, data) {
    t.ok(!err);
    t.equal(data.protocol, 'XCP');
    t.equal(data.object, 'DOMAIN');
    t.equal(data.response_text, 'Command successful');
    t.equal(data.action, 'REPLY');
    t.equal(data.response_code, 200);
    t.equal(data.is_success, true);
    t.equal(typeof data.attributes, 'object');
    t.equal(data.attributes.page, 1);
    t.equal(data.attributes.remainder, 1);
    t.equal(data.attributes.total, 25);
    t.ok(data.attributes.exp_domains);
    t.ok(data.attributes.exp_domains.length > 0);
    t.ok(data.attributes.exp_domains[0].hasOwnProperty('name'));
    t.ok(data.attributes.exp_domains[0].hasOwnProperty('expiredate'));
    t.ok(data.attributes.exp_domains[0].hasOwnProperty('f_let_expire'));
    t.ok(data.attributes.exp_domains[0].hasOwnProperty('f_auto_renew'));
    t.done();
  });
};

exports.getBalance = function (t) {
  var client = opensrs(config);
  client.req('balance', 'get_balance', function (err, data) {
    t.ok(!err);
    t.ok(data.response_text);
    t.equal(data.response_code, 200);
    t.ok(data.attributes);
    t.equal(data.is_success, true);
    t.done();
  });
};

exports.domainLookupNoDomainParamFailure = function (t) {
  var client = opensrs(config);
  client.req('domain', 'lookup', function (err, data) {
    t.ok(!err);
    t.ok(data.response_text);
    t.equal(data.response_code, 701);
    t.equal(data.is_success, true);
    t.done();
  });
};

exports.domainLookupBadDomainFailure = function (t) {
  var client = opensrs(config);
  client.req('domain', 'lookup', { domain: 'xxx' }, function (err, data) {
    t.ok(!err);
    t.ok(data.response_text);
    t.equal(data.response_code, 701);
    t.equal(data.is_success, true);
    t.done();
  });
};

exports.domainLookupAvailable = function (t) {
  var client = opensrs(config);
  client.req('domain', 'lookup', { domain: 'lupomontero.com' }, function (err, data) {
    t.ok(!err);
    t.equal(data.response_text, 'Domain available');
    t.equal(data.response_code, 210);
    t.ok(data.attributes);
    t.equal(data.attributes.status, 'available');
    t.equal(data.is_success, true);
    t.done();
  });
};

exports.domainLookupTaken = function (t) {
  var client = opensrs(config);
  client.req('domain', 'lookup', { domain: 'e-noise-test9.com' }, function (err, data) {
    t.ok(!err);
    t.equal(data.response_text, 'Domain taken');
    t.equal(data.response_code, 211);
    t.ok(data.attributes);
    t.equal(data.attributes.status, 'taken');
    t.equal(data.is_success, true);
    t.done();
  });
};


exports.getDomainsByExpireDate = function (t) {
  var
    client = opensrs(config),
    now = new Date(),
    params = {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 300
    };

  client.req('domain', 'get_domains_by_expiredate', params, function (err, data) {
    t.ok(!err);
    t.ok(data && data.is_success);
    t.equal(data.response_code, 200);
    t.ok(data.attributes && data.attributes.exp_domains);
    t.done();
  });
};

exports.getBalanceResponseStream = function (t) {
  opensrs(config).req('balance', 'get_balance').on('data', function (data) {
    t.ok(data && data.is_success);
    t.equal(data.response_code, 200);
    t.done();
  });
};

exports.multipleSequentialAndConcurrentCalls = function (t) {
  var
    client = opensrs(config), count = 0,
    now = new Date(),
    params = {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 30
    };

  function done() {
    t.equal(client._activeRequests, 2 - count);
    if (++count === 3) { t.done(); }
  }

  client.req('balance', 'get_balance', function (err, data) {
    t.equal(data.response_code, 200);
    done();
  });
  client.req('domain', 'get_domains_by_expiredate', params, function (err, data) {
    t.equal(data.response_code, 200);
    done();
  });
  client.req('balance', 'get_balance', function (err, data) {
    client.req('domain', 'get_domains_by_expiredate', params, function (err, data) {
      t.ok(!err);
      t.ok(data && data.is_success);
      t.equal(data.response_code, 200);
      t.ok(data.attributes && data.attributes.exp_domains);
      done();
    });
  });
  t.equal(client._activeRequests, 3);
};
