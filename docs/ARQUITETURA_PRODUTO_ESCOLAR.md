# GREEN CITY — Arquitetura do produto digital escolar
**Documento de arquitetura do produto · 25/11/2026**

## Objetivo
Transformar o protótipo 3D em uma plataforma educacional que escolas possam contratar, mantendo uma campanha individual para cada aluno, progresso persistente, mapa de transformação ambiental e administração central do produto.

## Experiência do usuário
1. O usuário cria uma conta ou entra com e-mail e senha.
2. Depois de autenticar, abre o mapa ilustrado das dez regiões da cidade.
3. O mapa mostra o estado da campanha: cinza (conteúdo indisponível), vermelho (região degradada), amarelo (região em recuperação) e verde (região recuperada conforme critérios da fase).
4. O botão CONTINUAR leva à fase/missão salva.
5. O Caderno de Campo e o Caderno de Aprendizado acompanham a campanha.
6. O progresso é carregado após novo login, inclusive em outro dispositivo.

## Dois tipos de conta
### Administrador
- Acesso ao painel administrativo.
- Consulta a lista de usuários e suas contas.
- Promove usuário comum a administrador ou rebaixa administradores, exceto o último administrador.
- Cada alteração de papel gera registro de auditoria.
- Ferramentas de desenvolvimento e suporte ficam reservadas a administradores autenticados.

### Usuário
- Tem uma campanha independente.
- Só consulta e altera o próprio perfil e progresso.
- Não pode editar seu próprio papel nem tornar-se administrador pelo navegador.
- Não consegue consultar a campanha de outra pessoa.

Apenas os dois papéis globais `admin` e `user` serão usados nesta etapa. Recursos específicos de escolas, professores, turmas e licenças comerciais poderão ser adicionados futuramente sem transformar o cadastro inicial em múltiplos tipos de conta.

## Mapa ambiental
- Cinza: região ainda indisponível ou não jogável.
- Vermelho: região jogável ainda degradada na campanha.
- Amarelo: região em recuperação.
- Verde: objetivos essenciais concluídos e critérios ambientais simulados alcançados.
- A cor não muda apenas por abrir uma fase ou instalar um equipamento.

## Dados persistidos
- Perfil e papel global.
- Uma campanha por usuário.
- Fase atual, maior fase desbloqueada, pontuação e título.
- Progresso por região e por objetivo.
- Caderno de Campo, relatórios e reflexões.
- Eventos e histórico de ações administrativas.

O conteúdo pedagógico global permanece versionado no repositório. O banco guarda a evolução individual, não uma cópia de todo o conteúdo do jogo.

## Segurança e privacidade
- Supabase Auth gerencia identidade e sessões.
- As oito tabelas públicas têm RLS ativa.
- Nenhuma chave service role/secret vai para o navegador.
- Papéis são guardados em campo protegido do perfil; `user_metadata` editável pelo usuário não é usado como autorização.
- A promoção de papel é validada no servidor e auditada.
- O bootstrap do primeiro administrador exige e-mail confirmado e previamente autorizado em uma tabela privada.
- Minimizar dados pessoais, especialmente em contas de menores. Não coletar nascimento, endereço residencial ou informações desnecessárias.
- Antes da contratação escolar, preparar termos, política de privacidade, retenção/exclusão de dados e fluxos de responsabilidade/consentimento adequados ao público.

## Arquitetura técnica
- Frontend: React + TypeScript + Vite.
- Mundo 3D: Babylon.js.
- Identidade e sessões: Supabase Auth.
- Dados: PostgreSQL com RLS.
- Publicação: Vercel.
- Conteúdo: GitHub com histórico de versões.

## Sequência de implementação
1. Projeto Supabase e schema seguros — concluído.
2. Bootstrap da primeira conta administradora — depende da confirmação do e-mail do fundador.
3. Integrar Supabase Auth no frontend: cadastro, login, confirmação de e-mail, sessão e saída.
4. Criar o mapa principal com os dez estados da campanha.
5. Conectar a conclusão das Fases 01 e 02 ao banco sem perder o progresso local existente.
6. Criar o painel administrativo de gestão de contas.
7. Desenvolver a Fase 03 já persistindo a campanha.

## Critérios de aceite
- Cadastro, login, confirmação e logout funcionam.
- O usuário permanece autenticado após recarregar, de acordo com as regras de sessão.
- Duas contas de teste não conseguem ler ou alterar o progresso uma da outra.
- A campanha retorna em outro navegador/dispositivo.
- Só administrador autenticado vê ferramentas administrativas.
- Usuário comum não consegue alterar o próprio papel.
- O mapa representa o estado real do progresso.
- Fases atuais continuam jogáveis e o progresso passa a ser persistente.
