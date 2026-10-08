const ADMIN_REPO = process.env.ADMIN_REPO || 'brunomoritani-eseg/alg2-sorteio-admin';
const ADMIN_BRANCH = process.env.ADMIN_BRANCH || 'main';
const TOKEN = process.env.GITHUB_ADMIN_TOKEN || process.env.ADMIN_REPO_TOKEN;
const API_ROOT = `https://api.github.com/repos/${ADMIN_REPO}/contents`;

const HISTORY_PATH = 'sorteios/sorteios.json';
const ALLOWED_FILES = {
  formato: 'FORMATO.txt',
  exemplo: 'exemplo.txt',
  medio: 'medio.txt',
  oficial: 'oficial.txt'
};

function ghHeaders(accept = 'application/vnd.github+json') {
  return {
    Accept: accept,
    Authorization: `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alg2-sorteio-dados'
  };
}

async function getHistory() {
  const response = await fetch(
    `${API_ROOT}/${HISTORY_PATH}?ref=${encodeURIComponent(ADMIN_BRANCH)}`,
    { headers: ghHeaders() }
  );

  if (!response.ok) throw new Error(`Falha ao ler histórico: ${response.status}`);
  const payload = await response.json();
  const content = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return JSON.parse(content);
}

async function getTextFile(path) {
  const response = await fetch(
    `${API_ROOT}/${path}?ref=${encodeURIComponent(ADMIN_BRANCH)}`,
    { headers: ghHeaders('application/vnd.github.raw+json') }
  );

  if (!response.ok) throw new Error(`Falha ao ler dados: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!TOKEN) {
    return res.status(503).json({ error: 'O serviço ainda não foi configurado pelo professor.' });
  }

  const token = String(req.query.token || '');
  const fileId = String(req.query.arquivo || '');
  const fileName = ALLOWED_FILES[fileId];

  if (!/^[0-9a-f-]{36}$/i.test(token) || !fileName) {
    return res.status(400).json({ error: 'Solicitação de arquivo inválida.' });
  }

  try {
    const history = await getHistory();
    const draw = (history.sorteios || []).find(item => item.registro_id === token);

    if (!draw || !/^Q\d{2}$/.test(String(draw.questao || ''))) {
      return res.status(404).json({ error: 'Sorteio não encontrado.' });
    }

    const questionId = String(draw.questao);
    const content = await getTextFile(`dados/${questionId}/${fileName}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${questionId}-${fileName}"`);
    return res.status(200).send(content);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível obter o arquivo de dados.' });
  }
};
