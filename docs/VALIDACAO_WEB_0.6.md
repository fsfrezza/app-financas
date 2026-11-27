# Validação web da beta 0.6

Data: 27/11/2026. Base validada: 4f93e1af114eb8345e871f07685eab7791e4d5f2.

## Navegador real

Teste no site publicado, no perfil local sem conta, usando somente um arquivo fictício com 65 compras: 62 em outubro e 3 em novembro de 2026. Nenhuma fatura pessoal ou conta autenticada foi usada neste teste.

- A prévia separou corretamente os dois meses.
- A importação adicionou 65 documentos.
- Selecionar todos marcou os 65, incluindo os cinco registros da segunda página.
- A confirmação do lote mostrou 65 elegíveis e os totais por mês.
- O lançamento incluiu os itens no planejamento, sem marcar pagamentos ou recebimentos; saldo real permaneceu zero.
- O filtro de outubro exibiu 62 documentos.
- Downloads JSON documental e CSV financeiro foram abertos e verificados: ambos continham somente 62 registros, todos de competência 2026-10.

## Automação existente

Os 60 testes aprovados na implementação cobrem também complementação de meses, duplicatas, divergências, CSV com identificadores, períodos e preservação dos pagamentos. Os testes de simulação DOM incluem importação parcial e confirmação de complementos; esses casos não foram repetidos manualmente no navegador nesta rodada.

## Limites desta rodada

Não valida instalação em Android físico, permissões do seletor nativo, entrega de notificações, cadastro por e-mail ou sincronização real entre web e Android. Os dados fictícios do navegador de validação não representam os dados do usuário.

## Passagem da web sem conta para Android

O uso sem conta mantém os dados somente no navegador. Salvar Backup completo após terminar as revisões e restaurar esse backup no Android transporta o estado completo. Reimportar o arquivo documental original não reproduz revisões ou lançamentos feitos depois. Sincronização automática exige entrar na mesma conta Frezzatech e ativar o recurso. Guardar um backup completo antes de copiar dados locais para uma conta ou substituir um perfil.
