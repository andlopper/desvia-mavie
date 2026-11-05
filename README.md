# Desvia, Mavie!

## Jogue

[▶ Abrir o jogo](https://andlopper.github.io/desvia-mavie/)

## Sobre o projeto

**Desvia, Mavie!** é um protótipo jogável de reflexos para navegador, criado por mim como um projeto de estudos de desenvolvimento de jogos. Ele também faz parte do meu portfólio: uma forma prática de experimentar mecânicas, controles e apresentação de um jogo web enquanto sigo aprimorando o projeto.

O objetivo é desviar das bolas de futebol e sobreviver o máximo possível enquanto a dificuldade aumenta. O protótipo explora desenho e animação com Canvas 2D, detecção de colisões, controles por teclado, toque e gestos, além de uma interface adaptada para desktop e celular.

## Controles

**Desktop**

- `←` / `→` ou `A` / `D`: mover.
- `↑` / `W` / `Espaço`: pular.
- `↓` / `S`: abaixar.

**Celular ou tela sensível ao toque**

- Deslize para os lados no campo para mover.
- Deslize para cima para pular e para baixo para abaixar.
- Ou use os botões de movimento no rodapé.

## Tecnologias e conceitos praticados

- HTML, CSS e JavaScript sem dependências de build.
- Canvas 2D para desenhar o campo, o personagem e as bolas.
- Animação de jogo, controles responsivos e detecção de colisões.
- Dificuldade progressiva e recorde salvo no navegador com `localStorage`.
- Layout responsivo e interações com Pointer Events.

## Executar localmente

Requer Node.js 18 ou mais recente. Na pasta do projeto, execute:

```sh
node serve.mjs
```

Depois, abra [http://127.0.0.1:8000](http://127.0.0.1:8000). Para escolher outra porta, defina a variável `PORT` antes de iniciar o servidor.

## Estrutura

- `index.html`: estrutura da página e controles.
- `styles.css`: estilos e adaptação para diferentes telas.
- `game.js`: lógica, desenho, animação e controles do jogo.
- `game-logic.js`: funções puras da lógica, compartilhadas entre jogo e testes.
- `tests/`: testes unitários das mecânicas.
- `scripts/check-site.mjs`: verificação da página, servidor e assets locais.
- `.githooks/`: verificações automáticas antes de commits.
- `serve.mjs`: servidor local de pré-visualização.
# Testes e validação

O projeto usa o test runner nativo do Node.js, sem dependências de teste adicionais.

```sh
npm test
```

Esse comando executa os testes unitários da lógica de colisão, pulo e dificuldade, inicia o jogo num ambiente simulado para confirmar que o cronômetro avança e que as bolas aparecem, e verifica a página de entrada, o servidor de preview e a integridade dos sprites. `npm run check` verifica a sintaxe dos arquivos JavaScript.

O hook Git `pre-commit` roda `npm test` antes de criar cada commit. Para ativá-lo neste clone:

```sh
git config core.hooksPath .githooks
```

O workflow de publicação também executa `npm test` antes do deploy para GitHub Pages.

## Roteiro de teste manual

Além dos testes automatizados, confira no navegador desktop e em um celular ou emulação mobile:

1. Iniciar e reiniciar a partida; confirmar que o cronômetro e o recorde atualizam.
2. Andar para ambos os lados com teclas, botões e gesto lateral; observar a animação da passada.
3. Pular com teclado, botão e gesto para cima; conferir preparação, subida, descida e aterrissagem.
4. Manter o comando de abaixar e usar gesto para baixo; conferir a pose e se bolas altas passam sem colisão.
5. Confirmar que bolas rasteiras acertam o jogador quando ele não pula e que bolas aéreas não atingem o personagem agachado.
6. Deixar uma bola atingir o personagem; conferir fim de jogo, mensagem, recorde e reinício.
7. Redimensionar a janela e conferir que os controles e o campo continuam visíveis e utilizáveis.
8. Durante uma partida, mudar para outra aba e voltar; conferir a pausa visível e o botão para continuar.

Os testes automatizados cobrem regras determinísticas e integridade dos assets. A validação de animação, responsividade e sensação dos controles ainda exige inspeção manual no navegador.
