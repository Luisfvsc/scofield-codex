# Engenheiro IA MVP

Primeira versao funcional local do produto.

## O que ja faz

- Abre uma interface web local.
- Le a pasta do projeto.
- Lista arquivos encontrados.
- Recebe uma tarefa.
- Gera plano de execucao com IA real quando `OPENAI_API_KEY` esta configurada.
- Mantem fallback local quando nao ha chave de API.
- Sugere arquivos relevantes.
- Prepara um diff simulado em modo revisao.
- Prepara uma alteracao real em arquivo controlado.
- Permite escolher um arquivo alvo clicando na lista de arquivos ou digitando o caminho.
- Sugere automaticamente o arquivo alvo mais provavel para a tarefa.
- Gera patch estruturado por ancora quando encontra um ponto adequado no arquivo.
- Substitui trechos existentes quando encontra blocos marcados com `ENGENHEIRO_IA_PATCH_START` e `ENGENHEIRO_IA_PATCH_END`.
- So grava a alteracao depois de aprovacao explicita no botao `Aplicar aprovado`.
- Mostra historico da sessao com planos, propostas e aplicacoes aprovadas.
- Persiste o historico localmente em `data/history.json`.
- Estima tokens e custo por tarefa com valores configuraveis.
- Permite configurar politicas locais de permissao em `data/policy.json`.
- Mostra status e diff Git quando o projeto estiver dentro de um repositorio.
- Gera diff unificado e pode preparar proposta para ate 3 arquivos relacionados.

## Como rodar

Use o Node.js disponivel na maquina:

```powershell
node server.js
```

Depois abra:

```text
http://localhost:4173
```

## Conectar IA real

Defina sua chave antes de iniciar o servidor:

```powershell
$env:OPENAI_API_KEY="sua-chave-aqui"
$env:OPENAI_MODEL="gpt-5.4-mini"
$env:COST_INPUT_PER_1K="0"
$env:COST_OUTPUT_PER_1K="0"
node server.js
```

Se `OPENAI_API_KEY` nao existir, o MVP continua funcionando com o planejador local.
Os custos comecam zerados por padrao; configure `COST_INPUT_PER_1K` e `COST_OUTPUT_PER_1K` conforme o modelo e o preco comercial que voce quiser simular.

Se quiser usar o Node.js empacotado pelo ambiente atual:

```powershell
& "C:\Users\luiss\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\luiss\Documents\Codex\2026-06-07\vamos-recriar-o-codex-do-come\outputs\agente-mvp\server.js"
```

## Proxima evolucao

1. Integrar com GitHub ou GitLab.
2. Trocar JSON local por banco quando houver multiusuario.
3. Adicionar planos comerciais por usuario/equipe.
4. Criar contas, equipes e papeis de acesso.
5. Adicionar revisao tipo PR antes de aplicar.
