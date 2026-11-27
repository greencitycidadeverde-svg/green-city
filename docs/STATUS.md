# Estado do projeto — 27/11/2026

## Versão 0.4.28 — Fase 05 e replay da campanha
- Fases 01 a 05 possuem ambientes 3D jogáveis; fases 06 a 10 seguem no Estúdio Master/roteiro e ainda não têm cenários 3D próprios.
- Fase 05 — Zona Costeira inclui bacia, estuário, praia, mar, manguezal, centro educativo, laboratório, triagem de resíduos, observação da fauna e ponto de monitoramento.
- Fluxo da missão: investigar 3 trechos; recolher 4 resíduos comuns seguros; separar 4 categorias secas; registrar 3 pontos de restauração do manguezal; registrar 2 observações de fauna e um ponto de monitoramento da água.
- O mapa interno permite voltar às fases concluídas. Abrir uma fase concluída carrega o estado salvo; “Jogar novamente” inicia uma sessão limpa sem alterar a conclusão original.
- A sessão de replay não grava progresso, pontuação ou relatório da campanha original.
- A preservação do progresso depende da autenticação e da persistência Supabase utilizadas pelas fases anteriores.

## Validação desta entrega
- O commit e o estado do build/deploy serão registrados após a publicação.
- A compilação automatizada será verificada no Vercel. Não há teste manual interativo de gameplay nesta sessão; escala, colisões, legibilidade das placas e percurso visual precisam de conferência no navegador real.

## Versão 0.3.2 — refinamento visual do Centro Industrial e concepção do Porto
- Personagem, árvores e fachadas receberam mais detalhes procedurais, mantendo Babylon.js e sem novas dependências.
- EcoCentro agora identifica as cinco categorias com símbolos próprios, cores, nomes e exemplos de resíduos; a placa principal explica a separação.
- O desenho da Fase 02 — Porto foi documentado com áreas, objetivos, sistemas de água e logística, consequências ambientais e etapas de produção.
- A Fase 02 ainda é documentação de design: não existe cenário 3D jogável do Porto nesta versão.

## Verificação da versão 0.3.2
- Commit de código: `ce59068933df0f11e7d77c7be04cc7266c665458`; correção de tipagem das texturas: `e63eb651a50474fc99cfc27a8c017efaee003657`.
- Vercel deployment `dpl_6zwNT3WarisSdATAcK3ZBBMDs4CC` — estado READY, produção.
- Build TypeScript/Vite concluído; 2.034 módulos transformados.
- npm auditou 70 pacotes e encontrou zero vulnerabilidades; nenhuma dependência nova.
- Módulo 3D: 5.427,30 kB (1.203,20 kB gzip); o aviso de chunk acima de 500 kB permanece e requer otimização.
- Inspeção visual e teste manual no navegador ainda necessários para validar escala, orientação dos letreiros, legibilidade, interações e desempenho no computador do jogador.


## Direção do produto
GREEN CITY é um jogo educacional 3D de transformação urbana sustentável. Uma cidade grande é dividida em cinco regiões, cada uma funcionando como uma fase de recuperação.

## Versão 0.3.1 — ponto de entrega e interações contextuais
- EcoCentro ganhou área externa de descarga sinalizada, letreiro 3D com texto, rota de pedestres, piso de entrega e cinco contêineres por cor (papel, plástico, vidro, metal e orgânicos).
- A posição do ponto de entrega foi alinhada à plataforma externa; a interação usa distância horizontal para não ser afetada por diferenças pequenas de altura.
- Ao completar a coleta, o objetivo orienta o jogador até a placa ECOCENTRO; o botão contextual aparece quando ele chega perto e permite descarregar por clique ou tecla E.
- O veículo municipal passou a aceitar entrada em raio maior, medido no plano horizontal. Um botão contextual mostra “F · ENTRAR NO VEÍCULO” e também permite sair.
- O minimapa agora marca a posição do EcoCentro.
- A tela inicial apresenta a visão ecológica ampla: água, solo, árvores, fauna, ar, energia, mobilidade e qualidade de vida.

## Versão 0.3.0 — base visual reconstruída e publicada
- Reconstruída a folha de estilos global para tela de jogo em tela cheia, HUD, minimapa, missão, controles, mapa geral, Plano Urbano, carregamento e mensagens de erro.
- A tela inicial aparece antes da inicialização do mundo Babylon.js. O motor 3D só é importado quando o jogador escolhe começar.
- Primeiro bairro recebeu detalhes procedurais de fachadas, janelas, vitrines, toldos, faixa de pedestres, iluminação pública, bancos e lixeiras seletivas.
- Personagem ganhou silhueta procedural de agente ambiental, com capacete, uniforme, mochila, braços e pernas; cápsula invisível mantém colisões e movimentação.
- Os cinco resíduos têm silhuetas e materiais distintos: papel, plástico, metal, vidro e orgânico. A triagem ainda não é individual no inventário.
- Removido o efeito incorreto que mudava a cor da água e o tamanho de árvores quando o veículo era eletrificado. Recuperação hídrica e vegetal deve ser uma intervenção própria.
- Criado projeto Figma editável com conceito visual de HUD, mapa ilustrado, indicadores e componentes reutilizáveis.

## Sistemas preservados da versão anterior
- Mapa de cinco regiões: Centro Industrial, Porto, Periferia Verde, Reserva Florestal e Zona Costeira.
- Somente o Centro Industrial possui cenário 3D jogável.
- Coleta de cinco itens e entrega da carga no EcoCentro.
- Plano Urbano com indicadores didáticos de reciclagem, energia renovável, mobilidade sustentável e qualidade do ar.
- Instalação solar com ponto local de recarga.
- Conversão do veículo municipal a diesel para elétrico após a implantação solar.
- Liberação lógica do Porto ao atingir as metas de recuperação do primeiro bairro.

## Verificação da versão 0.3.1
- Build TypeScript/Vite concluído com sucesso.
- Vercel deployment `dpl_9ZVHsPHWiViTvsG2fb7pSwkKVnzH` — estado READY, produção.
- Auditoria de npm: 70 pacotes, zero vulnerabilidades.
- Página raiz verificada com HTTP 200.
- Não houve teste manual interativo nesta sessão; a confirmação final do comportamento visual e físico precisa do teste no navegador.

## Verificação da versão 0.3.0
- Commit publicado: 19c2193098f05f7653a30e2fa00a069183722379.
- Vercel: deployment dpl_4o3MqzZfJscnEJP5UHPmjydDjdFV — estado READY, produção.
- Build de TypeScript e Vite concluído com sucesso.
- npm install auditou 70 pacotes e encontrou 0 vulnerabilidades.
- Página raiz verificada com HTTP 200.
- Saída compilada: entrada da aplicação 199,72 kB (63,48 kB gzip); módulo do jogo Babylon.js 5.415,90 kB (1.199,89 kB gzip), carregado após clicar em começar.
- A compilação ainda reporta aviso Vite de chunk acima de 500 kB para o módulo 3D.

## Verificações ainda pendentes
- Teste manual no navegador das interações, colisões, câmera, coleta, entrega, veículo, menus e progressão.
- Inspeção visual da renderização real em navegador (a resposta HTTP e o build não confirmam a qualidade final da cena).
- Teste em computador físico com 8 GB de RAM.
- Redução e divisão adicionais do bundle Babylon.js antes de expandir muito o mundo.

## Limitações conhecidas
- As outras quatro regiões aparecem no mapa, mas não têm cenário 3D, missões ou simulação próprias.
- A cadeia de resíduos ainda não processa cada categoria de ponta a ponta até empresas recicladoras.
- Os indicadores e custos são simulação didática; não são medições ambientais auditadas.
- Ainda faltam NPCs, tráfego complexo, animações finais, salvamento persistente, contas, multiplayer, Scanner e verificação de impacto real.
- O cenário e o personagem são geometria procedural de protótipo, não modelos artísticos finais.

## Infraestrutura
- GitHub: greencitycidadeverde-svg/green-city, branch main.
- Vercel: projeto green-city, produção conectada ao GitHub.
- Figma: https://www.figma.com/design/0h4zS7dK3C6uJr3qVLo6On.
- fal e Context7 conectados. Nenhuma geração 3D paga foi iniciada.
- Supabase conectado; backend de jogo ainda não criado.
- Blender não é requisito do projeto nem será exigido do fundador ou dos jogadores.


## Revisão visual e integração energética 0.3.3
A versão 0.3.3 introduz uma tela de abertura mais próxima de um menu de jogo, com objetivos claros e linguagem visual mais colorida. No cenário, a identificação do EcoCentro foi ampliada e inclui uma legenda frontal para papel/papelão (azul), plástico (vermelho), vidro (verde), metal (amarelo) e orgânico (marrom), seguindo a Resolução CONAMA 275/2001. A instalação solar materializa painéis no telhado do EcoCentro e uma cobertura fotovoltaica sobre a vaga do veículo, incluindo carregador e cabo. A conversão elétrica muda visualmente a carroceria e inclui selos “100% EV”.
Limitação: os resíduos ainda são entregues como carga única; os cinco recipientes são elementos visuais/educativos e a triagem por item ainda não está implementada. A geração/recarga é uma representação simplificada de gameplay, não uma simulação elétrica de engenharia.


## Navegação da estação solar 0.3.4
O minimapa agora identifica a vaga municipal com a cor de status do veículo (amarela antes da conversão e verde depois). Após instalar os painéis ou converter o carro, a mensagem contextual orienta o jogador a seguir o marcador para conferir fisicamente a estação.


## Missões físicas de energia e mobilidade 0.3.5
As opções de instalação e conversão foram removidas do painel. Após entregar a carga, o jogador instala painéis em cada edifício individualmente por proximidade e tecla E. Cada instalação custa 10 CIT. Depois de três prédios, a base de eletrificação fica ativa. O jogador entra no carro no ponto inicial, dirige pela via de serviço, estaciona na vaga, para completamente, sai e interage ao lado do veículo para convertê-lo por 20 CIT. A conclusão exige oito telhados solarizados e o veículo elétrico.
A recompensa de entrega é de 100 CIT: 8 edifícios a 10 CIT e a conversão do veículo a 20 CIT.
O painel urbano agora é apenas informativo. Os prédios receberam acabamento texturizado e detalhes de cobertura; a árvore ganhou copa multifacetada e o carro recebeu janelas, espelhos, capô arredondado, lanternas e cubos de roda. São melhorias procedurais low-poly; não equivalem ainda a modelos artísticos GLB de produção.


## Orientação para a missão do veículo 0.3.6
O minimapa acompanha o veículo em tempo real e mantém a base de eletrificação como marcador de destino. O veículo começa em uma vaga demarcada próxima à avenida para facilitar sua localização após o jogador entregar os resíduos. Equipamentos de telhado foram movidos para as bordas para reduzir sobreposição com os arranjos fotovoltaicos.
