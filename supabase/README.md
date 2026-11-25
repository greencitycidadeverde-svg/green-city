# Provisionamento Supabase — GREEN CITY

Projeto ativo: `green-city` (região `sa-east-1`, São Paulo, Brasil).
Project ref: `hezrffoxlkzgcaruixsz`.
API URL: `https://hezrffoxlkzgcaruixsz.supabase.co`.

## Modelo atual de contas
Há somente dois papéis globais:
- `user`: usuário comum, com perfil e campanha próprios.
- `admin`: administrador, que pode consultar usuários e promover/rebaixar contas.

O papel não vem de `user_metadata` nem de campos editáveis no navegador. A promoção passa por uma função de API SECURITY INVOKER que delega a implementação privilegiada a uma função privada, verifica o administrador atual e registra a mudança em `admin_audit_log`. O último administrador não pode ser rebaixado.

## Banco de dados
A estrutura é aplicada no projeto ativo e as migrações remotas estão em `migrations/`.
- `profiles`: identidade do usuário, e-mail, nome e papel.
- `campaigns`: uma campanha independente por conta.
- `game_regions`: catálogo das dez regiões.
- `phase_progress`: estado, progresso e cor ambiental por fase.
- `objective_progress`: estado das missões/objetivos.
- `learning_journal`: Caderno de Campo e Caderno de Aprendizado.
- `progress_events`: eventos e pontuação.
- `admin_audit_log`: histórico de promoções/rebaixamentos.

Todas as oito tabelas públicas têm RLS habilitada. O usuário comum só lê e altera seus próprios dados; o administrador pode consultar dados de suporte. A tabela privada `private.bootstrap_admin_emails` mantém a lista de e-mails autorizados a receber o primeiro papel administrativo.

## Primeiro administrador
A conta inicial será promovida somente depois que o endereço correto for inserido em `private.bootstrap_admin_emails` e o e-mail estiver confirmado no Supabase Auth. O endereço precisa ser confirmado pelo proprietário; não inferimos o e-mail a partir da conta ChatGPT ou de outro serviço.

## Migrações
1. `20261125013128_initial_platform_schema.sql`
2. `20261125013209_admin_role_hardening.sql`
3. `20261125013233_role_update_rpc_safety.sql`

`initial_schema.sql` é um snapshot completo do estado final do schema. Em novos ambientes, prefira aplicar as migrações em ordem.

Nunca exponha uma chave `service_role` ou secret key no frontend, em variáveis `VITE_*`, no GitHub ou no navegador. Somente a chave publishable pode ser usada no cliente, sempre combinada com RLS.
