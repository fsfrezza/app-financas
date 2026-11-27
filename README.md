# Frezzatech Finanças

App para Android e navegador, com modo offline e sincronização opcional. Versão 0.4 beta para testes pessoais; ainda não é uma edição comercial.

Web: https://fsfrezza.github.io/app-financas/web/

## Android primeiro

Em [Actions](https://github.com/fsfrezza/app-financas/actions), abra a execução **Android APK e testes** mais recente com resultado verde. Em **Artifacts**, baixe **Frezzatech-Financas-Android-teste**, extraia o ZIP e instale `app-debug.apk` no Android 8 ou posterior. O Android pode pedir autorização para instalar a partir do app que abriu o arquivo.

Esse APK é de teste e usa assinatura de depuração. Não publique na Play Store. Builds diferentes podem usar chaves diferentes: antes de desinstalar para trocar uma versão, exporte um backup. Para distribuição estável, configurar chave de assinatura mantida em segredo, canal de atualização e política de privacidade. O workflow também pode ser iniciado manualmente em **Run workflow**.

## O que funciona

- Entradas e gastos com descrição, conta, categoria, datas de lançamento/vencimento/pagamento e observações.
- CRUD de lançamentos; edição e exclusão afetam somente a parcela selecionada.
- Parcelamento mensal de um valor total, com distribuição exata dos centavos e ajuste do último dia do mês.
- Pagamento e reabertura de parcelas; saldo por conta considera apenas valores pagos/recebidos.
- Categorias e contas editáveis; remoção bloqueada enquanto houver lançamentos associados.
- Painel mensal, filtros, avisos de contas vencidas e próximas do vencimento.
- Histórico de reposições (gás, filtros etc.) e previsão pela média dos intervalos. Um registro usa a duração inicial informada.
- Backup JSON, restauração validada e CSV para planilhas.
- Android: resumo diário opcional, sem valores no aviso, por volta das 9h; restabelecido após reiniciar o aparelho. Não depende de internet. As restrições do Android podem adiar notificações. Após “Forçar parada”, reabra o app para reativar o agendamento.
- Web: interface responsiva e instalação PWA quando o navegador permitir. Sem notificações de fundo na versão web.

## Privacidade e dados

Sem conta, os dados ficam no aparelho/navegador. A conta Frezzatech usa Supabase; somente ao ativar a sincronização os dados financeiros são enviados ao servidor, com acesso restrito ao proprietário. O Android solicita internet para autenticação e sincronização. Não há integração bancária, publicidade ou telemetria. Os backups JSON/CSV não são criptografados; guarde-os em local privado. Desinstalar, limpar dados ou trocar de navegador pode apagar o histórico. O código no GitHub não contém dados financeiros.

## Desenvolvimento

Requisitos web: Node 20+. O cliente Supabase é empacotado no build. Execute `npm ci` antes de construir.

```sh
npm test
npm run build
npm start
```

Abra `http://localhost:4173`. `web/` é a fonte compartilhada; `dist/` é a saída web. O Android empacota `web/` diretamente, sem baixar conteúdo remoto.

Android: JDK 17, Android SDK 35 e Gradle 8.9:

```sh
gradle -p android assembleDebug
```

A saída é `android/app/build/outputs/apk/debug/app-debug.apk`.

## Arquitetura

- `web/js/core.js`: regras financeiras independentes da interface, testáveis com Node.
- `web/js/app.js`: interface, persistência local, relatórios e ponte Android.
- `android/`: aplicativo nativo Java com WebView offline, seletor de arquivos do sistema e lembretes via AlarmManager.
- `tests/`: testes de valores, parcelas, datas, saldo, consumo, alertas e importação.
- `.github/workflows/android.yml`: validação e geração do APK de teste.

## Próximas etapas para oferecer a outras pessoas

1. Validar APK e entrega de notificações em aparelho real.
2. Assinatura estável de produção e atualizações sem perda dos dados.
3. Configurar envio de e-mails e validar cadastro, confirmação e recuperação; sincronização e isolamento já foram implementados e testados na API.
4. Recorrências, cartões/faturas, orçamentos e importação de extratos como módulos futuros; ainda não implementados.
5. Acessibilidade, revisão de segurança, documentação de privacidade e publicação em loja.

Não existe estimativa confiável de percentual do produto comercial antes de fechar esse escopo.

## Aparência (0.2)

Novo logo Frezzatech com fundo transparente. Em **Configurações → Aparência**, escolha **Claro** ou **Escuro**. A preferência fica salva neste aparelho e não altera os dados financeiros. O logo se adapta ao fundo. O APK de teste ainda pode exigir reinstalação caso a assinatura do build anterior seja diferente; exporte um backup antes de remover qualquer versão.

## Sincronização na beta 0.3

Conta própria por e-mail e senha; Google permanece desativado. Login sozinho não envia lançamentos: ative a sincronização na tela Conta. Em outro aparelho com dados online, use Baixar dados da conta. Dados antigos sem conta continuam separados; exporte backup antes de copiar ou substituir dados.

O envio padrão de e-mails do Supabase é restrito aos membros da equipe do projeto. Sem SMTP próprio, esta beta não oferece cadastro público ou recuperação para terceiros. A confirmação de e-mail permanece habilitada. Consulte [docs/SINCRONIZACAO.md](docs/SINCRONIZACAO.md).

Validação: 22 testes passaram, build web e APK concluídos, duas sessões da mesma conta compartilharam a carteira e outra conta não teve acesso. Falta validar instalação em aparelho físico e os fluxos de e-mail ponta a ponta.

## Planejamento financeiro (0.4)

- Formulário adaptado para entradas e saídas, com datas de recebimento/pagamento e detalhes recolhíveis. Categorias podem pertencer a entradas, saídas ou ambas; categorias antigas continuam disponíveis até reclassificação.
- Uma vez, mensal até encerrar, ou parcelado. Na criação das parcelas, escolha total ou valor de cada parcela. Mensal mantém o valor, não divide.
- Mensal fixo, estimado ou a informar; repetição automática sempre em aberto. Pular mês, pausar com mês de retomada, encerrar e alterar este mês ou este e os próximos em aberto. Mudanças futuras de valor/categoria/conta são suportadas; para mudar data de vencimento, edite cada ocorrência ou encerre e cadastre uma nova regra.
- Saldo real hoje separado de previsão ao fim do mês consultado, incluindo atrasos anteriores. Valores desconhecidos ou estimados sinalizam previsão parcial.
- Transferências entre contas registram dois lados, sem inflar receitas e despesas. Para corrigir uma transferência, exclua o par e registre novamente.
- Lembretes de entradas são opcionais por aparelho. Notificações Android carregam projeções de 12 meses, renovadas ao abrir/salvar/sincronizar o app; não há geração infinita em segundo plano.
- O histórico e backups anteriores são preservados. Atualize todos os aparelhos para a 0.4 antes de usar recorrências: versões antigas não conhecem as novas regras. Backup JSON guarda regras; CSV expande ocorrências até o fim do mês selecionado (e inclui registros efetivos já salvos), sem criar infinitas linhas futuras.
