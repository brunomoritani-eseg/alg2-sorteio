const assert = require('assert');

process.env.GITHUB_ADMIN_TOKEN = 'token-de-teste';
const handler = require('../api/dados');

function responseMock() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }
  };
}

async function testValidDownload() {
  const token = '123e4567-e89b-12d3-a456-426614174000';
  const history = { sorteios: [{ registro_id: token, questao: 'Q17' }] };
  const expected = Buffer.from('1 2000 10 10 10\nT000001 1 5 1 1\n', 'utf8');
  let calls = 0;

  global.fetch = async () => {
    calls++;
    if (calls === 1) {
      return new Response(JSON.stringify({
        content: Buffer.from(JSON.stringify(history), 'utf8').toString('base64')
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(expected, { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  const res = responseMock();
  await handler({ method: 'GET', query: { token, arquivo: 'oficial' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(Buffer.compare(res.body, expected), 0);
  assert.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8');
  assert.match(res.headers['content-disposition'], /Q17-oficial\.txt/);
  assert.strictEqual(calls, 2);
}

async function testRejectedRequests() {
  let res = responseMock();
  await handler({ method: 'POST', query: {} }, res);
  assert.strictEqual(res.statusCode, 405);

  res = responseMock();
  await handler({ method: 'GET', query: { token: 'invalido', arquivo: 'oficial' } }, res);
  assert.strictEqual(res.statusCode, 400);

  res = responseMock();
  await handler({ method: 'GET', query: { token: '123e4567-e89b-12d3-a456-426614174000', arquivo: '../segredo' } }, res);
  assert.strictEqual(res.statusCode, 400);
}

(async () => {
  await testValidDownload();
  await testRejectedRequests();
  console.log('API de dados: testes concluídos com sucesso.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
