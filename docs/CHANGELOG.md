## [0.3.4] - 2026-11-24
- Adicionado marcador dedicado da vaga municipal/estação solar no minimapa.
- Mensagens após instalar painéis e converter o veículo orientam o jogador até o local físico da intervenção.

## [0.3.3] - 2026-11-24
- Tela de abertura redesenhada como menu de jogo, com objetivos claros e linguagem visual mais colorida.
- EcoCentro com recipientes ampliados, pictogramas/nomenclaturas maiores e painel educativo frontal com as cinco categorias.
- Veículo municipal reposicionado em vaga demarcada fora da faixa principal da rua.
- Instalação solar agora materializa painéis no EcoCentro e cobertura fotovoltaica sobre a vaga, com carregador e cabo junto ao carro.
- Conversão elétrica altera a carroceria e acrescenta selos visíveis “100% EV”.
- Ajustes iniciais de iluminação, céu, vegetação e fachadas para um estilo low-poly mais vivo.

# Changelog

## 0.3.2 — refinamento visual e desenho do Porto
- Personagem agente ambiental recebeu uniforme de campo mais completo, colete, faixas refletivas, identificação, luvas, proteções e mochila detalhada.
- Árvores ganharam troncos afunilados, galhos e copas em camadas com variação de tons.
- Fachadas receberam pilastras, divisórias nas janelas e letreiros com nomes de estabelecimentos.
- Recipientes do EcoCentro passaram a exibir pictogramas diferentes, cores, nomes em português e exemplos de materiais: papel, plástico, vidro, metal e orgânico.
- Placa educativa ampliada para explicar a separação dos materiais.
- Criado o documento de conceito e fluxo jogável da Fase 02 — Porto. O bairro continua em planejamento, sem cenário 3D jogável nesta versão.


## 0.3.1 — EcoCentro e ações contextuais
- Construído um ponto físico externo de entrega de resíduos com sinalização ECOCENTRO, área de descarga, caminho de acesso e cinco recipientes coloridos de triagem.
- A entrega usa distância horizontal e raio de interação maior, com indicação contextual e ação por tecla E ou clique.
- O veículo municipal agora tem raio de embarque ampliado e botão contextual de entrar/sair, além da tecla F.
- O minimapa marca a posição do EcoCentro.
- A tela inicial reforça o foco ecológico completo: água, solo, árvores, fauna, ar, energia, mobilidade e qualidade de vida.

## 0.3.0 — Reconstrução da base visual e do primeiro bairro
- Reconstruída a folha de estilos global que estava sem o layout principal do jogo: canvas em tela cheia, HUD, missão, minimapa, overlays e painéis.
- Separado o carregamento do módulo 3D: a tela inicial aparece primeiro e o Babylon.js só começa a ser baixado quando o jogador seleciona Começar.
- Adicionados estados visuais de carregamento e falha de inicialização do mundo 3D.
- Enriquecido o primeiro bairro com fachadas, janelas, vitrines, toldos, faixas de pedestres, iluminação pública, bancos e lixeiras seletivas.
- Criada uma silhueta procedural de agente ambiental com capacete, uniforme, mochila e membros, mantendo uma cápsula invisível para colisão.
- Os cinco resíduos receberam formas e materiais diferentes para comunicar categorias visuais.
- Corrigido o efeito visual indevido em que eletrificar a frota também alterava a cor do rio e o tamanho das árvores. Recuperação hídrica e vegetal precisa de intervenções próprias.
- Criado um projeto visual editável no Figma para a linguagem do HUD e da tela de jogo.
- Verificado build de produção e HTTP 200. O módulo Babylon continua com 5.415,90 kB, mas é carregado após o início da partida. O aviso de chunk grande permanece e exige otimização adicional.
