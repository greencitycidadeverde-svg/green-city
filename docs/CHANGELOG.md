# Changelog

## 0.3.0 — Reconstrução da base visual e do primeiro bairro
- Reconstruída a folha de estilos global que estava sem o layout principal do jogo: canvas em tela cheia, HUD, missão, minimapa, overlays e painéis.
- Separado o carregamento do módulo 3D para que a interface inicial não importe o jogo Babylon.js de forma síncrona.
- Adicionados estados visuais de carregamento e falha de inicialização do mundo 3D.
- Enriquecido o primeiro bairro com fachadas, janelas, vitrines, toldos, faixas de pedestres, iluminação pública, bancos e lixeiras seletivas.
- Criada uma silhueta procedural de agente ambiental com capacete, uniforme, mochila e membros, mantendo uma cápsula invisível para colisão.
- Os cinco resíduos receberam formas e materiais diferentes para comunicar categorias visuais.
- Corrigido o efeito visual indevido em que eletrificar a frota também alterava a cor do rio e o tamanho das árvores. Recuperação hídrica e vegetal precisa de intervenções próprias.
- Criado um projeto visual editável no Figma para a linguagem do HUD e da tela de jogo.

## 0.2.1
- Adicionada a progressão por regiões e o ciclo de recuperação urbana.
- Atualizado Vite para uma versão de correção de segurança e alinhado o runtime Node ao Vercel.
