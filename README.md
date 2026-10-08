# Alg2 Sorteio

Ambiente de testes do sorteador do projeto de Algoritmos 2.

O repositório público contém a interface dos alunos e o mecanismo de solicitação. O banco reservado, o mapeamento **questão → paradigma**, a distribuição e o histórico oficial ficam no repositório privado `alg2-sorteio-admin`.

## Teste atual

Há cinco questões de teste, uma por paradigma. A dupla abre uma solicitação usando o formulário do GitHub. Um workflow serializa os sorteios, impede um segundo sorteio da mesma dupla, escolhe uma categoria ainda disponível de forma balanceada e registra o resultado no repositório privado.

## Configuração necessária uma única vez

O workflow precisa acessar o repositório privado.

1. Crie um **fine-grained Personal Access Token** para a conta `brunomoritani-eseg`.
2. Dê acesso somente ao repositório `alg2-sorteio-admin`.
3. Em **Repository permissions**, conceda **Contents: Read and write**.
4. No repositório público, abra **Settings → Secrets and variables → Actions**.
5. Crie o secret `ADMIN_REPO_TOKEN` com esse token.

Sem esse secret, a interface existe, mas o workflow não consegue ler ou gravar o repositório privado.

## Como testar

1. Abra uma nova issue usando o formulário **Sorteio de teste**.
2. Informe duas pessoas fictícias.
3. Envie a solicitação.
4. O resultado deve aparecer como comentário e a issue será fechada automaticamente.
5. Confira o novo registro em `sorteios/sorteios-teste.json` no repositório privado.
6. Repita o teste com os mesmos RAs: o sistema deve devolver a mesma questão e não criar outro registro.

## GitHub Pages

O arquivo `index.html` já está pronto. Para publicar a interface, habilite o Pages em:

**Settings → Pages → Deploy from a branch → main → / (root)**

Depois disso, a interface ficará disponível no endereço de GitHub Pages do repositório.

## Segurança do desenho

O repositório público não contém o gabarito nem o paradigma esperado para cada questão. O workflow lê essas informações somente do repositório privado e publica ao aluno apenas o enunciado sorteado.
