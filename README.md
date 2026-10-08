# Alg2 Sorteio

Sistema de sorteio do projeto de Algoritmos 2.

## Arquitetura

- **GitHub**: código-fonte e armazenamento dos dados.
- **Vercel**: hospeda a interface e a função serverless `/api/sortear`.
- **alg2-sorteio-admin**: repositório privado contendo banco de questões, gabarito e histórico.

A interface nunca recebe o paradigma esperado. A função serverless consulta o repositório privado, registra o sorteio e devolve apenas o enunciado.

## Trabalho individual ou em dupla

O aluno 1 é obrigatório. O aluno 2 é opcional.

Se o aluno 2 estiver vazio, o sorteio é registrado como **individual**. Se houver dois alunos, nome e RA dos dois precisam estar preenchidos.

Um RA só pode participar de um sorteio. Isso impede que alguém sorteie individualmente e depois tente realizar novo sorteio em outra dupla.

## Banco oficial

O sistema utiliza 20 questões, distribuídas igualmente entre cinco paradigmas. Cada questão pode ser usada uma vez por turno. Os arquivos de dados permanecem no repositório privado e são entregues somente ao participante ou dupla que recebeu a questão.

## Variáveis de ambiente necessárias na Vercel

- `GITHUB_ADMIN_TOKEN`: fine-grained token com **Contents: Read and write** somente em `alg2-sorteio-admin`.
- `ADMIN_REPO`: opcional; padrão `brunomoritani-eseg/alg2-sorteio-admin`.
- `ADMIN_BRANCH`: opcional; padrão `main`.

## Teste esperado

1. Acesse a URL da Vercel.
2. Preencha apenas o aluno 1 para testar sorteio individual.
3. Faça outro teste preenchendo aluno 1 e aluno 2.
4. Repita com um RA já utilizado: o sistema deve bloquear novo sorteio.
5. Repita exatamente o mesmo participante ou dupla: o sistema devolve a questão original.
6. Confira o histórico em `sorteios/sorteios.json` no repositório privado.
7. Confirme que os quatro arquivos `.txt` da questão podem ser baixados.

O fluxo antigo baseado em GitHub Issues foi removido.


## Painel administrativo

A página `/admin.html` permite ao professor:

- listar todos os sorteios;
- buscar um sorteio por RA;
- ver participantes, questão, paradigma e enunciado;
- cancelar um sorteio, liberando os RAs para um novo sorteio.

O painel é protegido pela variável de ambiente `ADMIN_PANEL_PASSWORD`.

## Auditoria do enunciado

Novos sorteios armazenam também um snapshot da questão no histórico, preservando o título e o enunciado exatamente como foram entregues ao aluno naquele momento.
