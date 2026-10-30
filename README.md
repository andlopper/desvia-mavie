# Desvia, Mavie!

Protótipo web responsivo de um jogo de reflexos, feito com HTML, CSS e JavaScript sem dependências de build.

## Executar

Abra `index.html` em um navegador moderno. Para usar um endereço local no navegador, execute o servidor estático incluído (requer Node.js 18 ou mais recente):

```sh
node serve.mjs
```

Depois acesse `http://127.0.0.1:8000`. O servidor só escuta conexões locais e serve os arquivos do próprio projeto. O jogo usa Canvas 2D, Pointer Events e Web Audio opcional. O melhor tempo fica salvo no `localStorage` do navegador.

## Publicar no GitHub Pages

1. Envie este projeto para um repositório público no GitHub.
2. No repositório, abra **Settings → Pages** e escolha **GitHub Actions** como fonte.
3. O workflow em `.github/workflows/pages.yml` publica automaticamente a branch `main`.
4. Aguarde a primeira execução. O endereço ficará no formato `https://<usuario>.github.io/<repositorio>/`.

O jogo é estático e não precisa de etapa de build. O site publicado e o código no repositório público ficam visíveis a qualquer pessoa.

## Como jogar

- Desktop: segure ←/→ ou A/D para mover; ↑/W/Espaço pula e ↓/S abaixa.
- Toque: arraste o personagem no campo, use os direcionais e os botões de pulo/abaixar.
- Pule sobre as bolas rasteiras e abaixe para deixar passar as bolas altas. As colisões são verificadas enquanto a bola cruza o personagem.
- O pulo começa com uma breve flexão dos joelhos; ao abaixar, o personagem inclina o tronco e agacha com os joelhos dobrados.
- Sobreviva às bolas. O intervalo entre lançamentos diminui e elas chegam mais rápido com o passar do tempo.
- O som começa desligado e pode ser ativado no controle ♪.

## Validação manual

1. Abra a página em um navegador desktop e inicie a partida pelo botão e pela tecla Espaço.
2. Verifique movimento com setas e A/D, flexão antes do pulo com ↑/W/Espaço, agachamento com ↓/S, limites do campo, colisão/fim de jogo e reinício.
3. Deixe uma rodada terminar, confirme que o tempo final e o recorde aparecem e que o recorde persiste ao recarregar.
4. Repita em viewport estreita ou em um celular: arraste no canvas, use os quatro botões na tela e confirme que a página não rola durante o gesto.
5. Ative o som e confirme que o jogo continua funcional caso o navegador bloqueie áudio ou armazenamento.
6. Confira foco visível dos botões, contraste dos textos e que o conteúdo cabe sem corte em telas pequenas.

## Estrutura

- `index.html`: semântica, textos e controles.
- `styles.css`: apresentação responsiva e estados de foco/redução de movimento.
- `game.js`: desenho, atualização do jogo, controles, dificuldade progressiva e persistência local.
- `serve.mjs`: servidor local de preview, sem dependências externas.

O desenho é feito com formas Canvas, então o protótipo não depende de imagens ou serviços externos para os personagens e o campo.
