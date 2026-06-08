# Plano de Produto: Agente de Engenharia Assistido por IA

## Posicionamento

Criar um produto proprio de agente de programacao, inspirado na categoria de ferramentas como Codex, mas com marca, interface, fluxos, codigo e proposta comercial proprios.

O produto nao deve copiar nome, identidade visual, codigo, textos proprietarios ou comportamentos internos exclusivos de terceiros. A proposta e construir uma alternativa comercial com foco claro em produtividade de engenharia, controle, auditoria e adaptacao ao mercado-alvo.

## Promessa Principal

Um assistente que entende um projeto de software, planeja mudancas, edita arquivos, executa verificacoes, revisa riscos e entrega resultados rastreaveis para equipes tecnicas e empresas.

## Publico-Alvo Inicial

1. Pequenas e medias software houses que precisam entregar mais rapido.
2. Startups com times enxutos de engenharia.
3. Consultorias que fazem manutencao, migracao e modernizacao de sistemas.
4. Empresas com codigo legado que precisam de automacao supervisionada.

## Diferenciais Comerciais

1. Foco em portugues e times brasileiros/latino-americanos.
2. Relatorios de mudanca compreensiveis para gestores e desenvolvedores.
3. Modo supervisionado para ambientes corporativos.
4. Integracao com repositorios Git, tarefas, documentacao e pipelines.
5. Controles de custo por tarefa, usuario, projeto e cliente.
6. Biblioteca de fluxos prontos: corrigir bug, criar tela, escrever teste, revisar PR, documentar modulo, migrar framework.

## MVP

O primeiro produto deve ser simples, funcional e vendavel:

1. Interface de chat para tarefa de codigo.
2. Leitura de repositorio local ou conectado ao Git.
3. Planejamento automatico antes de alterar arquivos.
4. Edicao de arquivos com diff revisavel.
5. Execucao de comandos permitidos, como testes e build.
6. Resumo final com arquivos alterados, riscos e verificacoes.
7. Historico de tarefas por projeto.

## Modulos Tecnicos

1. Orquestrador de agente
   - Recebe objetivo do usuario.
   - Divide em etapas.
   - Decide quando ler arquivos, editar, testar ou pedir confirmacao.

2. Camada de ferramentas
   - Leitura e escrita de arquivos.
   - Busca no codigo.
   - Execucao controlada de comandos.
   - Git diff, branch, commit e PR.
   - Navegador para validar frontends.

3. Memoria de projeto
   - Padroes do repositorio.
   - Comandos de teste.
   - Regras do time.
   - Decisoes anteriores.

4. Motor de seguranca
   - Permissoes por pasta, comando e integracao.
   - Bloqueio de comandos destrutivos.
   - Mascaramento de segredos.
   - Logs auditaveis.

5. UI do produto
   - Chat orientado a objetivos.
   - Painel de plano.
   - Visualizador de diff.
   - Terminal resumido em linguagem simples.
   - Status de verificacoes.

6. Billing e administracao
   - Usuarios e equipes.
   - Projetos.
   - Limites de uso.
   - Planos por assento, uso ou tarefas.

## Arquitetura Inicial

Frontend:
- Web app com React/Next.js ou desktop com Electron/Tauri.

Backend:
- API em Node.js, Python ou Go.
- Fila de tarefas para execucoes longas.
- Banco relacional para usuarios, projetos, tarefas e auditoria.

Execucao:
- Sandbox por projeto.
- Workspace isolado.
- Politicas de permissao.
- Logs completos de acao.

IA:
- Camada abstrata de modelos.
- Suporte inicial a OpenAI Responses API ou equivalente.
- Possibilidade futura de multi-provedor.

## Modelo de Receita

1. Plano Individual
   - Para freelancers e desenvolvedores independentes.
   - Limite mensal de tarefas ou tokens.

2. Plano Equipe
   - Por usuario/mês.
   - Historico compartilhado, projetos e revisao.

3. Plano Empresa
   - SSO, auditoria, permissoes, ambientes isolados e suporte.

4. Servicos Profissionais
   - Implantacao em empresas.
   - Criacao de fluxos personalizados.
   - Integracao com repositorios e pipelines internos.

## Riscos

1. Risco legal
   - Evitar marca, nome e interface de terceiros.
   - Criar identidade propria.
   - Validar termos de uso das APIs e bibliotecas usadas.

2. Risco tecnico
   - Agentes podem cometer erros.
   - Toda mudanca deve ser revisavel.
   - Testes e diff devem ser centrais no fluxo.

3. Risco comercial
   - Mercado competitivo.
   - Diferenciacao deve ser vertical: idioma, compliance, consultorias, codigo legado ou times especificos.

4. Risco de custo
   - Controlar chamadas de modelo.
   - Cachear contexto.
   - Limitar tarefas longas.
   - Medir custo por execucao.

## Roadmap

### Fase 1: Prototipo Local

Objetivo: provar que o agente consegue alterar um projeto real com seguranca.

Entregas:
- Chat simples.
- Leitura de arquivos.
- Busca no codigo.
- Edicao com diff.
- Execucao de testes.
- Relatorio final.

### Fase 2: MVP Vendavel

Objetivo: permitir uso por pequenos times.

Entregas:
- Login.
- Projetos.
- Historico de tarefas.
- Integracao Git.
- Politicas de permissao.
- Billing basico.

### Fase 3: Produto para Equipes

Objetivo: vender para empresas e consultorias.

Entregas:
- Organizacoes.
- Auditoria.
- Templates de fluxos.
- Revisao de PR.
- Integracao com GitHub/GitLab.
- Painel de custos.

### Fase 4: Plataforma

Objetivo: permitir extensoes e automacoes.

Entregas:
- Plugins.
- Skills/workflows customizados.
- Marketplace interno.
- Agentes especializados.
- Execucoes agendadas.

## Primeira Versao a Construir

Nome temporario: Engenheiro IA

Fluxo principal:
1. Usuario escolhe uma pasta de projeto.
2. Usuario descreve a tarefa.
3. Agente analisa arquivos relevantes.
4. Agente apresenta plano curto.
5. Agente altera arquivos.
6. Agente executa verificacoes.
7. Usuario revisa diff e aceita ou rejeita.

## Proximo Passo Tecnico

Construir um prototipo local com:
- Interface web simples.
- Backend local.
- Ferramentas de leitura, busca e edicao.
- Integracao com um modelo via API.
- Historico de uma tarefa.
- Relatorio final em linguagem clara.

