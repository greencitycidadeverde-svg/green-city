# Estado do projeto — 24/11/2026

## Direção do produto
GREEN CITY é um jogo educacional 3D de transformação urbana sustentável. Uma cidade grande é dividida em cinco regiões, cada uma funcionando como uma fase de recuperação.

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
