# Conta Frezzatech e sincronização opcional

Estado: versão 0.3 beta para testes pessoais. Banco provisionado em São Paulo no plano gratuito; retornos web e Android configurados. Os 22 testes locais e o build passaram. O teste real da API confirmou duas sessões da mesma conta, isolamento de outra conta e bloqueio de revisão antiga. Nenhum dado financeiro pessoal foi enviado.

## Fluxo do usuário

1. Sem login: funcionamento local como antes.
2. Entrar/criar conta por e-mail e senha; confirmar o e-mail quando exigido.
3. Os perfis locais são separados por ID de usuário. Os dados antigos sem conta ficam preservados na chave anterior.
4. Ativar sincronização explicitamente. Antes dessa confirmação, nenhum lançamento é enviado.
5. Em aparelho novo com dados online existentes, usar **Baixar dados da conta** antes de editar. A substituição local exige confirmação e recomenda backup.
6. Para levar os dados anteriores, usar **Copiar dados sem conta**. Isso pausa a sincronização e não apaga a cópia original sem conta.
7. Quando há conexão e o app está aberto, tentar enviar após edições, ao retomar o app e a cada minuto. Não há promessa de envio em segundo plano.
8. Edições independentes são combinadas. Edições concorrentes no mesmo registro, ou exclusão versus edição, interrompem o envio. O usuário exporta backup e escolhe qual conjunto manter; não há escolha silenciosa por horário do aparelho.
9. Sair retorna ao perfil sem conta. Dados locais de cada usuário permanecem separados, sem apagar alterações pendentes.
10. Tema, antecedência e permissão de notificações são preferências de cada aparelho.

## Ativação necessária

- Instalar/conectar a integração Supabase à conta do proprietário do projeto.
- Escolher/criar um projeto em plano autorizado pelo proprietário. Nenhum plano pago foi autorizado.
- Aplicar a migração em `supabase/migrations/202611270001_finance_sync.sql`.
- Habilitar confirmação de e-mail, revisar limite de tentativas, política de senhas e envio de e-mail transacional. Cadastro, confirmação e recuperação de senha precisam de teste real.
- Criar `config/cloud.public.json` a partir do exemplo usando apenas URL e chave pública publicável (ou legacy anon). **Nunca** usar `service_role`, secret keys ou senha de banco no app, APK ou Git.
- Hospedar a versão com conta no GitHub Pages existente ou infraestrutura própria autorizada. A autenticação própria é independente do login da hospedagem Sites; não substituir ou contornar a autenticação gerenciada de Sites.
- Registrar o URL real de retorno web e `br.com.frezzatech.financas://auth/callback` nos redirects permitidos.
- Google é opcional: configurar OAuth no Google Cloud/Supabase, verificar domínio e ativar `googleEnabled` somente após teste web e Android. Não mostrar um botão que ainda não funciona.
- Antes de publicar, revisar a política de privacidade e o consentimento exibido no app.

## Regras do banco

- Uma carteira financeira JSON por usuário, com revisão crescente.
- RLS permite SELECT somente ao proprietário autenticado. Usuários anônimos não têm acesso.
- Escritas diretas são negadas: a função de escrita verifica sessão, proprietário esperado e revisão anterior.
- Uma revisão antiga retorna zero linhas, e o cliente busca e combina novamente até três tentativas.
- Transações de outro usuário não podem ser consultadas; teste obrigatório com dois usuários reais antes de ativação.
- Limite de 5 MB por carteira nesta implementação inicial. Não é contabilidade multiempresa nem sistema de auditoria comercial.

## Android

- Continua empacotando a interface offline.
- Rede liberada somente para o host Supabase configurado; páginas externas não recebem a ponte nativa.
- OAuth abre no navegador do sistema e retorna por deep link com PKCE.
- Tokens e verificador PKCE usam Android Keystore/AES-GCM. Não há fallback para texto simples no Android.
- O APK 0.2 continua sem sincronização. O APK 0.3 beta inclui o servidor configurado; a instalação e o fluxo completo ainda precisam de teste em aparelho físico.

## Validação

Executar `npm ci`, `npm test`, `npm run build`. A configuração ausente deixa a sincronização claramente indisponível e preserva o modo offline.

Antes de liberar: testar criação, confirmação, entrada/saída, recuperação, troca de senha, dois usuários isolados, dois aparelhos, sessão expirada, alterações concorrentes, exclusões offline, falha de rede e restauração de backup. Testes unitários não substituem essa validação.

## Projeto provisionado

- Projeto: `mhvhorlmcjsfcpihtmup` — Frezzatech Financas.
- Organização: fsfrezza's Org; região: sa-east-1 (São Paulo).
- Custo consultado de criação: US$ 0/mês no plano atual.
- Migração `finance_sync` aplicada. Função privilegiada em schema privado, wrapper invoker público; acesso anônimo negado.
- Testes SQL com dois usuários simulados: isolamento de leitura, rejeição de escrita em outro usuário, bloqueio de escrita direta e controle de revisão. Transação desfeita; zero contas de teste restantes.
- Verificação de segurança retornou lista de alertas vazia.
- URL e chave publicável presentes em `config/cloud.public.json`. Chave publicável é própria para frontend; nenhuma chave secreta ou service_role está no código.

## Retornos confirmados no painel

Em Authentication → URL Configuration:

- Site URL: `https://fsfrezza.github.io/app-financas/web/`
- Redirect URLs: `https://fsfrezza.github.io/app-financas/web/`
- Redirect URLs: `br.com.frezzatech.financas://auth/callback`

Manter confirmação de e-mail habilitada. Não habilitar Google antes de configurar e validar as credenciais OAuth do proprietário.

## Limite da versão de testes

SMTP personalizado está desativado no painel. O envio padrão do Supabase atende somente endereços dos membros da equipe do projeto; cadastro público e recuperação de senha para terceiros não estão liberados. Documentação: https://supabase.com/docs/guides/auth/auth-smtp

O proprietário escolheu preparar a versão de testes sem contratar domínio ou serviço de e-mail. A confirmação de e-mail permanece habilitada. Google permanece desativado. Não prometer cadastro público funcional nesta beta.

Validação real da API: login por senha em duas sessões da mesma conta; carteira compartilhada; atualização de revisão 1 para 2; rejeição de revisão antiga; leitura e escrita por outra conta bloqueadas. Sessões de QA encerradas. As duas contas sintéticas foram removidas; consulta posterior confirmou zero contas de QA restantes.

Antes de oferecer a terceiros: configurar envio de e-mails, validar confirmação e recuperação ponta a ponta, testar APK em aparelho físico e revisar privacidade/distribuição comercial.

Publicação beta confirmada em https://fsfrezza.github.io/app-financas/web/ — tela Conta e sincronização inspecionada. O APK da mesma base de código foi compilado no run 45927421746. A distribuição comercial e o cadastro público seguem pendentes.

