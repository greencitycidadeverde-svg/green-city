# Estado do projeto — 24/11/2026

## Direção
GREEN CITY é um jogo educacional 3D de transformação urbana sustentável. A cidade é um mapa dividido em cinco regiões; cada região funciona como uma fase de recuperação.

## Entrega 0.3.0 — implementada no código
- Reconstruída a folha global de estilos para a tela de jogo, HUD, minimapa, missão, mapa, Plano Urbano, carregamento e mensagens de erro.
- Inicialização do mundo 3D separada do carregamento inicial da interface React.
- Primeiro bairro recebeu detalhes procedurais de fachadas, janelas, vitrines, toldos, faixa de pedestres, iluminação pública, bancos e lixeiras seletivas.
- Personagem recebeu silhueta procedural de agente ambiental; cápsula de colisão permanece invisível e independente.
- Cinco resíduos têm agora silhuetas e materiais distintos: papel, plástico, metal, vidro e orgânico. A triagem ainda não é individual no inventário.
- Removido o efeito indevido que alterava água e árvores quando o jogador eletrificava o veículo. Recuperação de rios e vegetação deve ser uma decisão separada.
- Criado arquivo Figma editável com conceito de HUD, mapa ilustrado, indicadores e componentes reutilizáveis.

## Sistemas anteriores preservados
- Mapa geral com Centro Industrial, Porto, Periferia Verde, Reserva Florestal e Zona Costeira.
- Somente o Centro Industrial possui cenário 3D jogável.
- Coleta e entrega de cinco itens no EcoCentro.
- Plano Urbano com indicadores didáticos de reciclagem, energia renovável, mobilidade sustentável e qualidade do ar.
- Instalação solar e infraestrutura local de recarga.
- Conversão do veículo municipal a diesel para elétrico, condicionada à implantação solar.
- Desbloqueio lógico do Porto ao atingir metas do primeiro bairro.

## Verificações pendentes desta revisão
- Aguardando compilação e deploy da revisão 0.3.0.
- Build e HTTP 200 não comprovam gameplay manual. Coleta, entrega, colisões, veículo, câmera, menus e desempenho precisam de inspeção interativa.
- Verificar tamanho e divisão do bundle depois da separação do módulo 3D.
- Testar em computador físico com 8 GB de RAM.

## Limitações conhecidas
- As outras quatro regiões aparecem no mapa de progressão, mas não têm cenários 3D ou missões jogáveis.
- O sistema de resíduos ainda não leva cada categoria do inventário até uma empresa recicladora.
- Custos e indicadores são balanceamento didático, não medições ambientais auditadas.
- Ainda faltam NPCs, tráfego complexo, animações finais, salvamento persistente, contas, multiplayer, Scanner e verificação de impacto real.
- O cenário é procedural; modelos de produção finais ainda não foram incluídos.

## Infraestrutura
- GitHub: greencitycidadeverde-svg/green-city.
- Vercel: projeto green-city ligado ao branch main.
- Figma: https://www.figma.com/design/0h4zS7dK3C6uJr3qVLo6On.
- fal e Context7 conectados. Nenhum gerador 3D pago foi executado.
- Supabase conectado, mas backend de jogo ainda não criado.
- Blender não é requisito; o desenvolvimento da fase inicial é feito por código e recursos web.
