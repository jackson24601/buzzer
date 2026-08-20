# Classroom Buzzer

A simple website for in-class quiz games. Students join from a laptop or phone, pick one of four team colors, and that device becomes a buzzer. The teacher screen shows **which team pressed first**. Reset between questions and go again.

## How to use it in class

1. On the projector or teacher computer, open the site and click **Start a game**.
2. A four-letter room code (and QR code) appears. Students open the same site, enter the code and their name, and pick **Red, Blue, Green, or Yellow**.
3. Read the question. When you are ready, click **Open buzzers** (or press spacebar).
4. The first team to press locks the round. Late teams still show up in order, so you can move to second place if the first team is wrong.
5. Click **Next question** to reset. Buzzers stay closed until you open them again, so nobody can jump the next prompt.

Students can press the on-screen button or the spacebar. Several students can sit on the same color; the first press from that team is what counts.

## Run it

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

```bash
npm test
```

runs the first-press / reset rules without a browser.

## Deploy

Any Node host works (Render, Railway, Fly, a classroom PC). Set `PORT` if the platform needs it. Because buzzes are decided on the server, a slightly laggy student Wi-Fi connection cannot rewrite who was first.
