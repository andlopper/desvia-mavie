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
- `serve.mjs`: servidor local de pré-visualização.
