# Supabase — GREEN CITY

- Organização selecionada: `greencitycidadeverde-svg's Org`.
- Plano verificado: Free.
- Projeto Supabase: não criado.
- Decisão técnica: não precisamos de backend para o protótipo single-player. A pontuação CIT é local, simulada e sem valor financeiro.

## Cuidados para uma futura integração
Não conectar banco ao cliente Web até que o projeto esteja ativo, as tabelas estejam desenhadas e RLS esteja habilitado. Nunca expor service-role ou secret keys no navegador. A cotação de US$ 0/mês não representa capacidade ilimitada; recursos e tráfego têm limites no plano gratuito.

Quando tabelas precisarem ser acessadas via Data API, declarar explicitamente os GRANT necessários, habilitar RLS e criar políticas restritas.
