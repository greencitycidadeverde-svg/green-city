# Provisionamento Supabase — GREEN CITY

Este diretório contém a estrutura-base planejada para o backend escolar multi-instituição.

1. O arquivo initial_schema.sql só deve ser aplicado no projeto Supabase aprovado para GREEN CITY.
2. Antes da aplicação, confirmar o projeto e seu custo/plano.
3. Após aplicar, verificar todas as tabelas, grants, RLS policies e funções com as ferramentas Supabase.
4. A conta fundadora será promovida a platform_admin por uma operação privilegiada, depois de efetuar o primeiro cadastro.
5. Nunca colocar service_role em variáveis VITE_*, no GitHub ou no navegador.

Este schema inicial suporta aluno, professor, administrador escolar e administrador da plataforma. Não representa ainda o painel completo de escola, turmas ou cobrança comercial.
