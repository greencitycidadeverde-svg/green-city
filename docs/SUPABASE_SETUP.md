# Supabase — GREEN CITY

## Projeto provisionado
- Organização: `greencitycidadeverde-svg's Org`.
- Projeto: `green-city`.
- Project ref: `hezrffoxlkzgcaruixsz`.
- Região: `sa-east-1` (São Paulo, Brasil).
- Estado verificado: `ACTIVE_HEALTHY`.
- Cotação no momento da criação: US$ 0/mês. Isso não significa uso ilimitado; o plano Free possui limites de capacidade e tráfego.
- API URL: `https://hezrffoxlkzgcaruixsz.supabase.co`.

## Banco aplicado e verificado
Migrações remotas:
- `20261125013128 initial_platform_schema`
- `20261125013209 admin_role_hardening`
- `20261125013233 role_update_rpc_safety`

Foram criadas oito tabelas públicas com RLS habilitada e dez regiões no catálogo. As tabelas guardam perfis, campanha individual, progresso das fases, objetivos, cadernos, eventos e auditoria administrativa.

A revisão de segurança do Supabase retornou zero lints. O relatório de performance ainda mostra índices não utilizados, esperado em uma base recém-criada e sem usuários ativos.

## Papéis
O produto começa com somente dois papéis: `admin` e `user`. O administrador gerencia os papéis; o usuário só acessa a própria campanha e seus dados. A operação de mudança de papel é protegida e auditada.

## Bootstrap da conta fundadora
Ainda não foi inserido o e-mail do primeiro administrador. O usuário precisa informar o endereço exato a ser usado no GREEN CITY. Ele será colocado na lista privada de bootstrap; a conta deverá confirmar esse e-mail antes de receber o papel `admin`.

## Próxima etapa
Integrar Supabase Auth ao frontend React, configurar as variáveis públicas no Vercel, construir login/cadastro e conectar o mapa ao progresso persistente. Nenhuma tela de login foi publicada nesta etapa e ainda não existe usuário cadastrado.
