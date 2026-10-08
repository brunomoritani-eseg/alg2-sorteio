const crypto = require('crypto');

const ADMIN_REPO = process.env.ADMIN_REPO || 'brunomoritani-eseg/alg2-sorteio-admin';
const ADMIN_BRANCH = process.env.ADMIN_BRANCH || 'main';
const TOKEN = process.env.GITHUB_ADMIN_TOKEN || process.env.ADMIN_REPO_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD;
const API_ROOT = 'https://api.github.com/repos/' + ADMIN_REPO + '/contents';

const PATHS = {
  questions: 'banco/questoes.json',
  key: 'professor/gabarito.json',
  history: 'sorteios/sorteios.json'
};

function ghHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + TOKEN,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alg2-sorteio-admin'
  };
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

async function getJsonFile(path) {
  const response = await fetch(
    API_ROOT + '/' + path + '?ref=' + encodeURIComponent(ADMIN_BRANCH),
    { headers: ghHeaders() }
  );

  if (!response.ok) {
    throw new Error('Falha ao ler ' + path + ': ' + response.status);
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { sha: payload.sha, data: JSON.parse(content) };
}

async function updateJsonFile(path, sha, data, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');

  const response = await fetch(API_ROOT + '/' + path, {
    method: 'PUT',
    headers: {
      ...ghHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content,
      sha,
      branch: ADMIN_BRANCH
    })
  });

  if (response.status === 409) {
    const err = new Error('CONFLICT');
    err.code = 'CONFLICT';
    throw err;
  }

  if (!response.ok) {
    throw new Error('Falha ao atualizar histórico: ' + response.status);
  }
}

function normalizeRa(value) {
  return String(value || '').trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function recordKey(draw) {
  return draw.registro_id || ((draw.dupla_chave || '') + '|' + (draw.data || ''));
}

function projectDraw(draw, questionById) {
  const snapshot = draw.questao_snapshot || questionById[draw.questao] || {
    id: draw.questao,
    titulo: 'Questão sem título',
    enunciado: ''
  };

  return {
    record_key: recordKey(draw),
    registro_id: draw.registro_id || null,
    turno: draw.turno || null,
    tipo: draw.tipo || ((draw.alunos || []).length === 1 ? 'individual' : 'dupla'),
    alunos: draw.alunos || [],
    questao: snapshot,
    paradigma: draw.paradigma || null,
    data: draw.data || null,
    origem: draw.origem || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!TOKEN) {
    return res.status(503).json({ error: 'Token do repositório administrativo não configurado.' });
  }

  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Senha do painel administrativo não configurada.' });
  }

  const suppliedPassword = req.headers['x-admin-password'];
  if (!safeEqual(suppliedPassword, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Senha administrativa inválida.' });
  }

  const body = req.body || {};
  const action = String(body.action || 'list');

  try {
    if (action === 'list') {
      const [historyFile, questionsFile] = await Promise.all([
        getJsonFile(PATHS.history),
        getJsonFile(PATHS.questions)
      ]);

      const questionById = Object.fromEntries(
        (questionsFile.data.questoes || []).map(q => [q.id, q])
      );

      const query = normalizeRa(body.ra);
      let draws = historyFile.data.sorteios || [];

      if (query) {
        draws = draws.filter(draw =>
          (draw.alunos || []).some(aluno => normalizeRa(aluno.ra).includes(query))
        );
      }

      draws = draws
        .slice()
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        .map(draw => projectDraw(draw, questionById));

      return res.status(200).json({
        total: draws.length,
        sorteios: draws
      });
    }

    if (action === 'delete') {
      const target = String(body.record_key || '');
      if (!target) {
        return res.status(400).json({ error: 'Registro não informado.' });
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const historyFile = await getJsonFile(PATHS.history);
          const history = historyFile.data;
          const draws = history.sorteios || [];
          const index = draws.findIndex(draw => recordKey(draw) === target);

          if (index < 0) {
            return res.status(404).json({ error: 'Sorteio não encontrado.' });
          }

          const removed = draws[index];
          history.sorteios = draws.filter((_, i) => i !== index);

          await updateJsonFile(
            PATHS.history,
            historyFile.sha,
            history,
            'admin: cancelar sorteio ' + target
          );

          return res.status(200).json({
            ok: true,
            removido: {
              alunos: removed.alunos || [],
              questao: removed.questao || null,
              data: removed.data || null
            }
          });
        } catch (error) {
          if (error && error.code === 'CONFLICT') continue;
          throw error;
        }
      }

      return res.status(503).json({
        error: 'O histórico mudou durante a exclusão. Tente novamente.'
      });
    }

    return res.status(400).json({ error: 'Ação administrativa inválida.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Não foi possível acessar o histórico de sorteios.'
    });
  }
};
