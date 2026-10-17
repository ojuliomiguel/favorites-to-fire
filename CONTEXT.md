# Favorites to Fire

App pessoal para zerar o backlog de favoritos salvos em vários sites: a IA organiza e propõe a triagem, o dono aprova e consome, e o jogo mostra o que foi aprendido, consumido ou descartado como ruído.

## Language

### Origem

**Favorito**:
Um conteúdo salvo para consumir depois (tweet, vídeo, página), identificado pela sua URL canônica. Existe uma única vez, venha de quantas Fontes vier.
_Avoid_: bookmark, item, link, salvo

**Fonte**:
De onde um Favorito veio: X (Bookmarks), YouTube (Assistir mais tarde e playlists próprias), Edge ou Captura.
_Avoid_: origem, plataforma, site

**Importação**:
A entrada de Favoritos a partir de um arquivo exportado de uma Fonte. Pode ser repetida sem duplicar Favoritos.
_Avoid_: sync, sincronização

**Captura**:
O ato de salvar um Favorito direto no app, sem passar por uma Fonte externa (pelo Atalho do iPhone).
_Avoid_: share, compartilhar, salvar

**Backlog**:
Todos os Favoritos que ainda não chegaram ao fim do ciclo, ou seja, que não estão Descartados nem têm Desfecho. Zerar o Backlog é o objetivo do app.
_Avoid_: pendências, acúmulo

### Triagem

**Escopo**:
O assunto de um Favorito, escolhido de uma lista fixa e plana aprovada pelo dono. O Escopo "Outros" sempre existe e recebe o que não se encaixa.
_Avoid_: categoria, tag, tema, tópico

**Descoberta de escopos**:
A leitura do Backlog pela IA para propor a lista de Escopos, que o dono renomeia, junta, apaga e aprova. Pode ser repetida sobre o "Outros" quando ele cresce.
_Avoid_: clusterização, categorização

**Proposta**:
O que a IA sugere para um Favorito: Escopo, veredito (manter ou descartar), motivo em uma linha e tempo estimado de consumo.
_Avoid_: sugestão, classificação, palpite

**Triagem**:
A decisão sobre se um Favorito vai para a Fila ou é Descartado. A IA faz a Proposta, mas a Triagem só acontece quando o dono aprova. A IA sozinha nunca tria.
_Avoid_: classificação, filtragem

**Entrada**:
Os Favoritos que ainda não passaram pela Triagem.
_Avoid_: inbox, caixa de entrada

**Lote**:
Um conjunto de até 20 Favoritos da Entrada, do mesmo Escopo e com Proposta, que o dono revisa e aprova de uma vez. Só é montado quando o dono pede.
_Avoid_: batch, grupo, pacote

**Inverter**:
Trocar o veredito da Proposta de um Favorito dentro de um Lote antes de aprová-lo.
_Avoid_: corrigir, rejeitar

**Descartado**:
Um Favorito que saiu do Backlog na Triagem, sem ser aberto. Nunca é apagado.
_Avoid_: lixo, deletado, removido

**Resgatar**:
Trazer um Descartado de volta para a Fila.
_Avoid_: restaurar, desfazer

### Consumo

**Fila**:
Os Favoritos aprovados na Triagem que esperam para ser consumidos.
_Avoid_: lista, queue, watchlist

**Tempo disponível**:
O filtro de quanto tempo o dono tem agora: até 5 min, até 20 min ou longo. Ele define quais Favoritos da Fila podem ser o próximo.
_Avoid_: duração, janela

**Pular**:
Mandar o Favorito mostrado para o fim da Fila sem consumi-lo.
_Avoid_: adiar, snooze

**Em andamento**:
Um Favorito que foi aberto para consumo e ainda não tem Desfecho.
_Avoid_: aberto, consumindo, em progresso

**Desfecho**:
Como um Favorito consumido foi fechado: Aprendi, Consumi ou Lixo.
_Avoid_: status, resultado, conclusão

**Aprendi**:
Desfecho de um Favorito que deixou algo marcante. Exige uma Lição.

**Lição**:
Uma linha escrita pelo dono dizendo o que tirou de um Favorito.
_Avoid_: nota, anotação, insight, resumo

**Consumi**:
Desfecho de um Favorito consumido sem nada marcante.

**Lixo**:
Desfecho de um Favorito que foi aberto e era ruído. É diferente de Descartado, que nem chegou a ser aberto.
_Avoid_: descartado, inútil

**Ruído**:
Tudo o que terminou como Descartado ou Lixo. O "% de ruído" mede o quanto do que foi salvo não valia a pena.
_Avoid_: spam, lixo (como termo geral)

### Jogo

**XP**:
Pontos ganhos exclusivamente por Desfechos e pelos bônus ligados a eles. A Triagem não vale XP.
_Avoid_: pontos, score

**Nível**:
A faixa de XP acumulado em que o dono está, com custo crescente por Nível.
_Avoid_: rank, patente

**Sequência**:
A quantidade de dias seguidos com pelo menos um Desfecho.
_Avoid_: streak, ofensiva

**Conquista**:
Um marco desbloqueado por fatos reais do histórico (por exemplo, "50 aprendizados" ou "Zerou o escopo IA").
_Avoid_: badge, medalha, troféu

**Taxa de acerto da IA**:
A fração de Propostas que o dono não Inverteu, não Resgatou e que não terminaram em Lixo depois de mantidas.
_Avoid_: precisão, acurácia
