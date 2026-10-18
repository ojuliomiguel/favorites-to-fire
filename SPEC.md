# Spec: Favorites to Fire

> Vocabulário em [CONTEXT.md](./CONTEXT.md). Os termos em **negrito** seguem o glossário.
> Decidido numa sessão de grilling em 2026-10-17. O app é desenvolvido em incrementos: as telas surgem conforme a necessidade, e esta spec não fecha a lista delas.

## 1. Objetivo

Zerar o **Backlog** de favoritos salvos no X, no YouTube e no Edge. O app é de uso pessoal, com um único usuário.

A IA organiza por **Escopo** e propõe a **Triagem**. O dono aprova em **Lotes** e consome a **Fila**. O jogo (XP, níveis, conquistas) recompensa só o consumo e mostra o que foi aprendido, consumido ou descartado como **Ruído**.

**Fora de escopo:** sincronização automática por API, transcrição de vídeos, XP pela Triagem, revisão espaçada, exportar Lições para o Obsidian e desfazer o favorito na Fonte.

## 2. Ciclo de vida do Favorito

```
                       ┌─► Descartado ──(Resgatar)──┐
Importação ─┐          │                            ▼
            ├─► Entrada ──(Lote aprovado)──────► Fila ──(abrir)──► Em andamento ──┬─► Aprendi + Lição
Captura ────┘    (IA gera Proposta)                ▲                              ├─► Consumi
                                                   └──────(Pular: fim da Fila)    └─► Lixo
```

| De | Para | Gatilho | XP |
|---|---|---|---|
| — | Entrada | Importação ou Captura de uma URL que ainda não existe | 0 |
| Entrada | Fila / Descartado | aprovação do Lote, conforme o veredito (com ou sem Inversão) | 0 |
| Descartado | Fila | Resgatar | 0 |
| Fila | Fila (no fim) | Pular | 0 |
| Fila | Descartado | "Descartar" na pergunta que aparece no 3º Pular | 0 |
| Fila | Em andamento | "Abrir": leva ao app de origem (YouTube, X, Safari) | 0 |
| Em andamento | Desfecho | o dono fecha o item ao voltar | ver §6 |

- **Deduplicação por URL canônica:** `twitter.com` e `x.com` viram `x.com/{user}/status/{id}`; `youtu.be`, `m.youtube.com` e `/shorts/` viram `youtube.com/watch?v={id}`; parâmetros `utm_*`, `fbclid`, `si` etc. são removidos. Reimportar não duplica nada. Uma Fonte nova num Favorito que já existe só é registrada como Fonte adicional.
- **Nada é apagado.** Descartados ficam guardados para sempre.

## 3. Fontes e entrada

| Fonte | O que conta como favorito | Como entra | O que a IA lê |
|---|---|---|---|
| **Edge** | todos os favoritos (~102 hoje) | upload do HTML exportado (formato Netscape) | título, domínio, caminho da pasta + os primeiros ~2.000 caracteres do texto da página, buscado pelo Worker. Se a busca falhar, só os metadados |
| **X** | só Bookmarks (likes não) | upload do JSON gerado por um script de export da página de Bookmarks | texto do tweet e autor |
| **YouTube** | Assistir mais tarde + playlists criadas pelo dono (likes não) | Google Takeout (CSV) ou, se o Takeout não trouxer o Assistir mais tarde, um script de console na página da playlist | título, descrição, canal e duração (YouTube Data API com chave gratuita) |
| **Captura** | qualquer URL | Atalho do iPhone no menu Compartilhar: `POST` da URL com service token do Access | igual à Fonte da URL. Tweet via oEmbed do X (gratuito) |

Firefox, Safari e Chrome ficam de fora (o conteúdo deles repete o do Edge).

## 4. IA

- **Modelo:** DeepSeek V4.1 Flash, pela API compatível com o formato OpenAI. URL base e nome do modelo ficam em variáveis do Worker, e a chave fica num secret. Trocar de modelo não exige reescrever código.
- **Descoberta de escopos:** uma chamada com título, autor ou domínio, e pasta de todos os Favoritos. Ela devolve 10 a 20 Escopos com descrição e exemplos. O dono renomeia, junta, apaga e aprova, e a lista fica **fixa e plana**. O Escopo "Outros" sempre existe. A descoberta pode rodar de novo **só sobre o "Outros"** para propor Escopos novos, que o dono aprova.
- **Proposta:** cada Favorito na Entrada recebe Escopo, veredito (manter ou descartar), motivo em uma linha e tempo estimado. Vários Favoritos vão por chamada. A lista de Escopos e os exemplos ficam no início do prompt, para aproveitar o cache.
- **Aprendizado por exemplos (sem treinamento):** o prompt inclui as últimas Inversões, os Resgates e os "Lixo" de itens que a IA mandou manter, como exemplos de "isto o dono mantém / isto ele descarta".
- **Atalhos de ferramenta** (Gmail, banco, painéis) recebem a Proposta "descartar", com o motivo "atalho de ferramenta, não é conteúdo". Não existe estado separado para eles.
- **Falha:** um Favorito sem Proposta fica na Entrada aguardando nova tentativa e não entra em Lote.

## 5. Triagem e consumo

**Lote**
- Até **20** Favoritos da Entrada, do **mesmo Escopo**, todos com Proposta.
- É montado **só quando o dono pede**. Ele pode escolher o Escopo. Por padrão, o app usa o Escopo com mais Favoritos na Entrada.
- As Propostas de **descarte aparecem primeiro**, cada uma com o motivo.
- Um toque Inverte um item. "Aprovar lote" aplica todos os vereditos. Vale 0 XP.

**Consumo**
- O dono escolhe o Escopo (opcional) e o **Tempo disponível** (≤5 min, ≤20 min ou longo). O app mostra **um Favorito por vez**: o mais antigo da Fila que se encaixa.
- Ações: **Abrir** (vai para Em andamento e abre o app de origem) ou **Pular** (vai para o fim da Fila). A lista completa da Fila existe, mas não é a tela principal.
- No **3º Pular** do mesmo Favorito, ele volta perguntando "Ainda quer? Manter · Descartar". Descartar manda para Descartado, e Manter zera a contagem de Pulos.
- Ao abrir o app, os Favoritos **Em andamento** aparecem **no topo**, pedindo o Desfecho: "Como foi *[título]*? Aprendi · Consumi · Lixo".
- **Aprendi** exige a Lição (uma linha, não vazia).

## 6. Jogo

| Evento | XP |
|---|---|
| Desfecho **Consumi** | 5 |
| Desfecho **Lixo** | 5 (igual a Consumi, para não haver incentivo a mentir) |
| Desfecho **Aprendi** + Lição | 15 |
| Zerar um Escopo | +50, só quando é **um Desfecho** que esvazia a Fila e a Entrada daquele Escopo, e **uma vez por Escopo**. Esvaziar por descarte na Triagem não conta |

- **Sequência:** dias seguidos com ≥1 Desfecho, contados no fuso America/Sao_Paulo. Um dia sem Desfecho zera a contagem de dias.
- **Multiplicador da Sequência:** 1 + 0,1 × semanas acumuladas (de 0 a 10), ou seja, de ×1 a ×2. Cada semana completa de Sequência soma 1, e cada dia sem Desfecho tira 1. Uma gripe de um dia custa ×0,1, não o multiplicador inteiro.
- **Nível:** passar do Nível N para o N+1 custa 100·N XP.
- **Conquistas** (iniciais): Primeiro aprendizado · 50 aprendizados · Zerou o escopo *X* · 30 dias de Sequência · Detector de ruído (25 Lixos).
- **Fonte da verdade:** cada ação é gravada como um **evento** (Triagem, Inversão, Resgate, Pular, Abrir, Desfecho), com data e hora. XP, Nível, Sequência, Conquistas e estatísticas são **sempre recalculados a partir dos eventos**, nunca guardados como um placar acumulado. Os valores da tabela ficam numa constante, e alterá-los recalcula todo o histórico.
- **Horas economizadas** (a soma do tempo estimado dos Descartados) aparecem na tela inicial, ao lado do XP. O XP conta o que foi consumido, e as horas contam o que foi largado sem abrir.
- **Estatísticas:** Backlog restante com burndown e projeção ("no seu ritmo, zera em N semanas"), horas economizadas, % de Ruído por Fonte e por Escopo, Taxa de acerto da IA e lista de Lições.

## 7. Infra e stack

- **Cloudflare Workers + D1** (SQLite), em TypeScript. Deploy com `wrangler deploy`.
- **Hono + JSX renderizado no servidor**, com formulários HTML nativos e quase nenhum JS no cliente. Se uma tela pedir interatividade pesada, ela recebe uma ilha de JS própria.
- **PWA:** um manifest para "adicionar à tela de início" no iPhone.
- **Autenticação: Cloudflare Access** na frente de todas as rotas, liberando só o e-mail do dono. O Atalho do iPhone usa um **service token** (headers `CF-Access-Client-Id` e `CF-Access-Client-Secret`).
  - Toda rota pública (`workers.dev`, URLs de preview) precisa estar protegida pelo Access ou desativada.
  - O Worker valida o JWT do Access (`Cf-Access-Jwt-Assertion`) como segunda barreira.
- **Interface em pt-BR**, pensada primeiro para o celular.

## 8. Incrementos

### Incremento 1: o ciclo completo com o Edge
- [x] Worker + D1 publicados, com o Access protegendo todas as rotas e a validação de JWT no Worker
- [ ] Importar o HTML do Edge, com dedup por URL canônica (reimportar o mesmo arquivo não cria nada novo)
  - Hoje o banco aceita `favorites.url` em branco. A canonização rejeita, ou entra um CHECK (reconstruir `favorites` é barato enquanto ela está vazia).
- [ ] Buscar o texto das páginas do Edge (truncado), com fallback para metadados
- [ ] Descoberta de escopos → tela de aprovação da lista (renomear, juntar, apagar)
- [ ] Propostas para a Entrada
- [ ] Revisar Lote: por Escopo, até 20, descartes primeiro, Inverter, Aprovar
- [ ] Consumo: filtros de Escopo e Tempo disponível → um Favorito por vez → Abrir ou Pular
- [ ] Em andamento no topo → Desfecho (Aprendi exige Lição)
- [ ] Eventos gravados + XP total e horas economizadas visíveis na tela inicial
  - Hoje `UPDATE` e `DELETE` em `events` passam por cima do trigger do Desfecho. Um trigger append-only entra por migração nova, sem reconstruir a tabela.

### Incremento 2: X + Captura
- [ ] Importar o JSON de Bookmarks do X
- [ ] Atalho do iPhone → endpoint de Captura, autenticado por service token, com metadados via oEmbed
- [ ] Rodar a descoberta de escopos de novo sobre o "Outros"

### Incremento 3: YouTube
- [ ] Importar o Assistir mais tarde e as playlists (Takeout ou script de console)
- [ ] Buscar metadados e duração na YouTube Data API

### Incremento 4: o jogo completo
- [ ] Nível, Sequência com multiplicador, Conquistas, bônus por zerar um Escopo
- [ ] Tela de estatísticas
- [ ] Tela de Descartados com Resgatar
- [ ] Pergunta "Ainda quer?" no 3º Pular
- [ ] Taxa de acerto da IA

## 9. Em aberto (não bloqueia o Incremento 1)

- Volume do X e do YouTube: ainda desconhecido. Com centenas a poucos milhares de itens, a IA custa menos de US$ 1 para o Backlog inteiro.
- Se o Google Takeout traz o "Assistir mais tarde". Se não trouxer, usamos o script de console.
- Se a API da DeepSeek já serve o snapshot `V4.1-Flash-1017`. A tarifa de pico (01–04h e 06–10h UTC, em dias úteis) é o dobro, então a classificação do Backlog pode rodar fora desses horários.
- Qual script de export do X usar, e o formato exato do JSON dele.
- O Worker busca o JWKS do Access a cada requisição, sem cache nem timeout. Cache entra se o tráfego crescer.
- `ACCESS_TEAM_DOMAIN` com barra no final ou sem `https://` dá 403 em tudo. Normalizar só se o setup se repetir.

## 10. Decisões e porquês

| Decisão | Alternativa rejeitada | Por quê |
|---|---|---|
| Importar por arquivo | sincronização por API | o estoque é o que importa; a API do X é paga e a do YouTube não entrega o Assistir mais tarde |
| A IA propõe, o dono aprova em Lotes | a IA descarta sozinha | o placar precisa medir o dono, e o gosto dele não se adivinha no primeiro dia |
| Lote por Escopo, sob demanda | lote misto ou diário | o critério do dono fica estável dentro de um assunto, e lotes não revisados não se acumulam |
| Escopos descobertos pela IA e depois fixos | tags livres | triar em lote exige grupos estáveis; tags livres se fragmentam |
| XP só por Desfecho | XP por Triagem | aprovar é fácil de "farmar", e o consumo é o esforço real |
| Lixo vale o mesmo que Consumi | Lixo valer menos | admitir que era ruído não pode custar pontos |
| XP derivado de eventos | placar acumulado | ajustar a tabela recalcula o histórico sem migração |
| Horas economizadas ao lado do XP | XP por descarte na Triagem | descartar não pode valer zero, mas também não pode virar XP fácil de farmar |
| Bônus de Zerar Escopo uma vez por Escopo | bônus a cada vez que o Escopo esvazia | senão, capturar um link para um Escopo vazio e mandar para o Lixo rende 55 XP |
| Sequência linear | multiplicador composto (×1,1ⁿ) | a diferença máxima é de 0,25 (na 7ª semana), e o linear é mais fácil de prever e de testar |
| Um dia sem Desfecho tira 0,1 do multiplicador | voltar a ×1 | perder dez semanas por causa de uma gripe leva a consumir só para manter a Sequência |
| No 3º Pular, perguntar "Ainda quer?" | deixar o Favorito na Fila para sempre | o dono admite que pula o "longo" à noite; três Pulos já são um veredito |
| Abrir no app de origem | player embutido | a experiência no iPhone é melhor, e não é preciso detectar o fim do vídeo |
| SSR com Hono + JSX | React SPA | o app cresce uma rota por vez, sem duplicar API e cliente |
| Cloudflare Access | auth própria | é o lugar onde mais se erra em app pessoal, e o Access resolve sem código |
| DeepSeek V4.1 Flash | Claude Opus 5.5 / Haiku 5.5 | escolha do dono, por custo. A diferença para o Haiku é de centavos, e a troca é configuração |
