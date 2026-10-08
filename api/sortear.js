const { randomInt } = require('crypto');

const ADMIN_REPO = process.env.ADMIN_REPO || 'brunomoritani-eseg/alg2-sorteio-admin';
const ADMIN_BRANCH = process.env.ADMIN_BRANCH || 'main';
const TOKEN = process.env.GITHUB_ADMIN_TOKEN || process.env.ADMIN_REPO_TOKEN;
const API_ROOT = `https://api.github.com/repos/${ADMIN_REPO}/contents`;

const PATHS = {
  questions: 'banco/questoes-teste.json',
  key: 'professor/gabarito-teste.json',
  config: 'configuracao/distribuicao-teste.json',
  history: 'sorteios/sorteios-teste.json'
};

function ghHeaders() {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alg2-sorteio'
  };
}

async function getJsonFile(path) {
  const url = `${API_ROOT}/${path}?ref=${encodeURIComponent(ADMIN_BRANCH)}`;
  const response = await fetch(url, { headers: ghHeaders() });

  if (!response.ok) {
    throw new Error(`GitHub GET ${path}: ${response.status}`);
  }

  const payload = await response.json();
  const text = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');

  return {
    sha: payload.sha,
    data: JSON.parse(text)
  };
}

async function updateJsonFile(path, sha, data, message) {
  const url = `${API_ROOT}/${path}`;
  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');

  const response = await fetch(url, {
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
    const error = new Error('CONFLICT');
    error.code = 'CONFLICT';
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub PUT ${path}: ${response.status} ${body}`);
  }
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function normalizeRa(value) {
  return String(value || '').trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 30);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const aa = [...a].sort();
  const bb = [...b].sort();
  return aa.every((value, index) => value === bb[index]);
}

function choose(array) {
  return array[randomInt(array.length)];
}

function publicQuestion(question) {
  return {
    id: question.id,
    titulo: question.titulo,
    enunciado: question.enunciado
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!TOKEN) {
    return res.status(503).json({
      error: 'O serviço ainda não foi configurado pelo professor.'
    });
  }

  const body = req.body || {};
  const nome1 = normalizeName(body.nome1);
  const ra1 = normalizeRa(body.ra1);
  const nome2 = normalizeName(body.nome2);
  const ra2 = normalizeRa(body.ra2);

  if (!nome1 || !ra1) {
    return res.status(400).json({ error: 'Nome e RA do aluno 1 são obrigatórios.' });
  }

  const hasSecondName = Boolean(nome2);
  const hasSecondRa = Boolean(ra2);

  if (hasSecondName !== hasSecondRa) {
    return res.status(400).json({
      error: 'Preencha nome e RA do aluno 2 ou deixe os dois campos vazios.'
    });
  }

  if (ra2 && ra1 === ra2) {
    return res.status(400).json({ error: 'Os RAs dos integrantes precisam ser diferentes.' });
  }

  const participantes = [{ nome: nome1, ra: ra1 }];
  if (ra2) participantes.push({ nome: nome2, ra: ra2 });

  const requestedRas = participantes.map(p => p.ra);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [questionsFile, keyFile, configFile, historyFile] = await Promise.all([
        getJsonFile(PATHS.questions),
        getJsonFile(PATHS.key),
        getJsonFile(PATHS.config),
        getJsonFile(PATHS.history)
      ]);

      const questions = questionsFile.data.questoes || [];
      const key = keyFile.data.questoes || {};
      const config = configFile.data;
      const history = historyFile.data;
      history.sorteios = history.sorteios || [];

      const questionById = Object.fromEntries(questions.map(q => [q.id, q]));

      const touching = history.sorteios.filter(draw => {
        const drawRas = (draw.alunos || []).map(a => a.ra);
        return requestedRas.some(ra => drawRas.includes(ra));
      });

      if (touching.length > 0) {
        const sameDraw = touching.find(draw => {
          const drawRas = (draw.alunos || []).map(a => a.ra);
          return sameSet(drawRas, requestedRas);
        });

        if (sameDraw) {
          const q = questionById[sameDraw.questao];
          return res.status(200).json({
            ja_existia: true,
            participantes,
            questao: publicQuestion(q)
          });
        }

        return res.status(409).json({
          error: 'Um dos RAs informados já participou de outro sorteio.'
        });
      }

      const counts = {};
      const questionUses = {};

      for (const paradigm of Object.keys(config.max_por_paradigma || {})) {
        counts[paradigm] = 0;
      }

      for (const draw of history.sorteios) {
        counts[draw.paradigma] = (counts[draw.paradigma] || 0) + 1;
        questionUses[draw.questao] = (questionUses[draw.questao] || 0) + 1;
      }

      const maxUses = Number(config.max_usos_por_questao || 1);
      const eligibleByParadigm = {};

      for (const question of questions) {
        const info = key[question.id];
        if (!info) continue;

        const paradigm = info.paradigma;
        const maxParadigm = Number((config.max_por_paradigma || {})[paradigm] || 0);
        if (!maxParadigm) continue;
        if ((counts[paradigm] || 0) >= maxParadigm) continue;
        if ((questionUses[question.id] || 0) >= maxUses) continue;

        if (!eligibleByParadigm[paradigm]) eligibleByParadigm[paradigm] = [];
        eligibleByParadigm[paradigm].push(question);
      }

      const paradigms = Object.keys(eligibleByParadigm);

      if (paradigms.length === 0) {
        return res.status(409).json({
          error: 'O ambiente de testes está esgotado. Avise o professor para reinicializá-lo.'
        });
      }

      const minimum = Math.min(...paradigms.map(p => counts[p] || 0));
      const balanced = paradigms.filter(p => (counts[p] || 0) === minimum);
      const paradigm = choose(balanced);
      const question = choose(eligibleByParadigm[paradigm]);

      const timestamp = new Date().toISOString();

      history.sorteios.push({
        tipo: participantes.length === 1 ? 'individual' : 'dupla',
        dupla_chave: requestedRas.slice().sort().join('--'),
        alunos: participantes,
        questao: question.id,
        paradigma: paradigm,
        data: timestamp,
        origem: 'vercel-api'
      });

      await updateJsonFile(
        PATHS.history,
        historyFile.sha,
        history,
        `test: registrar sorteio ${question.id} para ${requestedRas.join('/')}`
      );

      return res.status(200).json({
        ja_existia: false,
        participantes,
        questao: publicQuestion(question)
      });
    } catch (error) {
      if (error && error.code === 'CONFLICT') {
        continue;
      }

      console.error(error);
      return res.status(500).json({
        error: 'Não foi possível concluir o sorteio. Tente novamente em alguns segundos.'
      });
    }
  }

  return res.status(503).json({
    error: 'Houve muitos sorteios simultâneos. Tente novamente em alguns segundos.'
  });
};
