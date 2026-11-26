# Frezzatech Finanças

App pessoal offline para Android e navegador. Versão 0.1.0, em validação: ainda não é uma edição comercial.

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

Dados no armazenamento local do aparelho/navegador. Não há banco remoto, login, integração bancária, publicidade, telemetria ou sincronização. O Android não solicita internet. Os backups JSON/CSV não são criptografados; guarde-os em local privado. Desinstalar, limpar dados ou trocar de navegador pode apagar o histórico. O código no GitHub não contém dados financeiros.

## Desenvolvimento

Requisitos web: Node 20+; nenhum pacote de terceiros em runtime.

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
3. Definir contas online, autenticação, sincronização e isolamento por usuário, caso desejados.
4. Recorrências, cartões/faturas, orçamentos e importação de extratos como módulos futuros; ainda não implementados.
5. Acessibilidade, revisão de segurança, documentação de privacidade e publicação em loja.

Não existe estimativa confiável de percentual do produto comercial antes de fechar esse escopo.
