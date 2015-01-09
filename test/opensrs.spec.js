var assert = require('assert');
var opensrs = require('../');


describe('opensrs', function () {

  it('should throw when user or key not passed', function () {
    assert.throws(function () {
      var client = opensrs();
    }, TypeError);
  });

  it('should throw when sandbox is not bool');

});


describe('opensrs._parseResponse', function () {

  it('should throw when bad xml', function (done) {
    opensrs._parseResponse('<i><am><broken</i>', function (err, data) {
      assert.ok(err);
      assert.ok(!data);
      done();
    });
  });

  it('should parse a balance xml response', function (done) {
    var xml = '<?xml version=\'1.0\' encoding="UTF-8" standalone="no" ?>' +
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

    opensrs._parseResponse(xml, function (err, data) {
      assert.ok(!err);
      assert.ok(data);
      assert.equal(data.protocol, 'XCP');
      assert.equal(data.object, 'BALANCE');
      assert.equal(data.response_text, 'Command successful');
      assert.equal(data.action, 'REPLY');
      assert.equal(data.response_code, 200);
      assert.equal(data.is_success, true);
      assert.equal(typeof data.attributes, 'object');
      assert.equal(data.attributes.balance, 215.14);
      assert.equal(data.attributes.hold_balance, 10.34);
      done();
    });
  
  });

  it('should parse a domains by expire date response', function (done) {
    var xml = '<?xml version=\'1.0\' encoding="UTF-8" standalone="no" ?>' +
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

    opensrs._parseResponse(xml, function (err, data) {
      assert.ok(!err);
      assert.equal(data.protocol, 'XCP');
      assert.equal(data.object, 'DOMAIN');
      assert.equal(data.response_text, 'Command successful');
      assert.equal(data.action, 'REPLY');
      assert.equal(data.response_code, 200);
      assert.equal(data.is_success, true);
      assert.equal(typeof data.attributes, 'object');
      assert.equal(data.attributes.page, 1);
      assert.equal(data.attributes.remainder, 1);
      assert.equal(data.attributes.total, 25);
      assert.ok(data.attributes.exp_domains);
      assert.ok(data.attributes.exp_domains.length > 0);
      assert.ok(data.attributes.exp_domains[0].hasOwnProperty('name'));
      assert.ok(data.attributes.exp_domains[0].hasOwnProperty('expiredate'));
      assert.ok(data.attributes.exp_domains[0].hasOwnProperty('f_let_expire'));
      assert.ok(data.attributes.exp_domains[0].hasOwnProperty('f_auto_renew'));
      done();
    });
  });

});

