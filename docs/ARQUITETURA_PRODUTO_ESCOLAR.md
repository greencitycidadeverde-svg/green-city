# GREEN CITY — Arquitetura do produto digital escolar
**Documento de arquitetura do produto · 24/11/2026**

## Objetivo

Evoluir o protótipo GREEN CITY para uma plataforma educacional contratável por escolas, com campanhas individuais, progresso persistente, professores acompanhando turmas e administração central do produto.

## Experiência do aluno

1. O aluno entra por uma tela de login ou cadastro.
2. Após autenticar, abre sua tela principal: o mapa ilustrado da cidade.
3. O mapa representa dez regiões e o estado ambiental de cada uma.
4. O aluno continua da missão em andamento ou entra em uma região já liberada.
5. Ao terminar uma fase, recebe o Caderno de Aprendizado e vê a região mudar de estado conforme critérios ambientais simulados.
6. O progresso, as missões e as descobertas são carregados quando ele retorna, inclusive em outro dispositivo.

## Linguagem visual do mapa

- Cinza: região planejada, sem cenário jogável ou indisponível.
- Vermelho: região jogável ainda degradada no estado da campanha.
- Amarelo: região atual, em recuperação.
- Verde: região recuperada depois de concluir os objetivos essenciais e alcançar os critérios da fase.
- A cor nunca deve ser concedida por abrir uma fase ou instalar um único equipamento; precisa refletir o progresso ambiental daquela campanha.

A tela principal terá o mapa como foco, botão CONTINUAR, identificação e nível do aluno, progresso geral, caderno e saída segura da conta. Em telas menores, o mapa será adaptável e continuará navegável por toque.

## Papéis e limites de acesso

### Plataforma GREEN CITY
- **Administrador da plataforma:** gestão de escolas, parâmetros globais, conteúdo das fases, suporte e ferramentas de desenvolvimento.
- **Aluno:** vê e altera somente o próprio perfil e campanha.
- **Professor:** consulta o progresso e os registros pedagógicos dos alunos que pertencem à mesma escola.
- **Administrador da escola:** gerencia os membros e as turmas da própria instituição e acompanha resultados da escola.

A função de administrador geral não pode ser escolhida pelo usuário durante cadastro. A atribuição será feita por operação privilegiada do projeto depois que a conta do fundador existir.

## Estrutura multi-escola

Uma conta poderá estar associada a uma ou mais escolas. A campanha pertence ao aluno, e as associações escolares definem quem pode acompanhar os dados. Isso evita duplicar o progresso quando o aluno participa de atividades em mais de uma instituição.

A primeira versão registra escola, papel e vínculo do membro. O controle de turmas, convites em lote e relatórios agregados pode evoluir sobre essa base sem alterar a campanha individual.

## Dados a persistir

- Perfil de aluno e identidade autenticada.
- Fase atual e maior fase liberada.
- Fases concluídas, pontos de conhecimento e título.
- Estado dos objetivos de cada fase, missão ativa e datas.
- Caderno de Campo e relatórios finais.
- Escola, vínculo e papel institucional.

O conteúdo pedagógico global (descrições, missões, critérios e relatórios-modelo) permanece versionado no código/repositório. O banco guarda o progresso individual e as evidências da campanha, não uma cópia completa do jogo.

## Segurança e privacidade

- Autenticação gerenciada pelo Supabase Auth.
- Chave publicável apenas no navegador; nunca enviar chave service_role ou segredo de servidor ao frontend.
- RLS em todas as tabelas expostas.
- Um aluno não pode ler o progresso de outro aluno.
- Professores e administradores escolares só podem consultar alunos vinculados à própria escola.
- Papéis administrativos são gerenciados no banco por operador autorizado; nunca confiar em user_metadata editável pelo usuário para permissões.
- Minimizar dados pessoais, especialmente em contas de menores. Não coletar data de nascimento, endereço residencial ou outros dados desnecessários ao jogo.
- A contratação escolar futura deverá incluir termos, política de privacidade, retenção/exclusão de dados e fluxo de consentimento/responsabilidade compatível com o público atendido.

## Modo de desenvolvimento

O painel atual ?modo=desenvolvimento é uma ferramenta temporária local para validar as fases que já existem. Ele não é o painel administrativo do produto. Na versão autenticada, ferramentas de desenvolvimento ficarão exclusivas do papel administrador da plataforma e serão validadas no banco.

## Arquitetura técnica

- Frontend: React + TypeScript + Vite.
- Mundo 3D: Babylon.js (mantido).
- Identidade: Supabase Auth.
- Dados: Supabase PostgreSQL com RLS.
- Publicação: Vercel.
- Conteúdo do jogo: GitHub, com histórico e revisão.
- Escolas: estrutura multi-tenant por schools e school_memberships.

## Sequência de implementação

1. Provisionar e configurar projeto Supabase na região de São Paulo, se disponível para a conta/plano escolhido.
2. Aplicar e verificar o schema com RLS e privilégios explícitos.
3. Criar cadastro, login, confirmação de e-mail, sessão persistente e saída.
4. Criar o bootstrap seguro da conta administradora da plataforma, depois da primeira inscrição.
5. Criar a tela principal do mapa e a seleção de fases a partir do progresso salvo.
6. Conectar a conclusão das Fases 01 e 02 ao banco sem perder as missões existentes.
7. Adicionar painel de professor e gestão de escolas em uma entrega separada, após validar login e progresso dos alunos.
8. Construir Fase 03 já utilizando o mesmo modelo persistente.

## Critérios de aceite da primeira entrega autenticada

- Cadastro, login, confirmação e sair funcionam.
- Usuário recarrega a página e continua autenticado, conforme configuração de sessão.
- Duas contas de teste não conseguem ler ou alterar o progresso uma da outra.
- Campanha é restaurada após login em outro navegador/dispositivo.
- Somente administrador autorizado vê ferramentas administrativas.
- Aluno não consegue tornar-se professor ou administrador por alterar dados no navegador.
- As fases 01 e 02 continuam jogáveis e seus marcos passam a persistir.
- Mapa representa o estado real do progresso e distingue regiões planejadas das regiões jogáveis.
