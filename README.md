IT CLASSROOM SHOWDOWN — SIMPLE PASSWORD-PROTECTED MULTIPLAYER SERVER
Created by Mian Mahad Mahmood

This is a small Node.js server app, not a Firebase app. Teams visit one public website and join the same live game. The host controls questions and the shared scoreboard updates live.

PASSWORDS
The app uses environment variables:
- ADMIN_PASSWORD = the private host password. Give this only to yourself.
- ROOM_PASSWORD = the team password. Give this to teams you want to allow.
Default demo values are provided in server.js for local testing. Change them on the hosting service before making the site public.

PUBLIC LINK
I cannot publish a public internet URL from this chat. You must deploy this folder to a Node.js host once. A straightforward option is Render:
1. Upload this project folder to a GitHub repository.
2. Go to https://render.com/ and create a new Web Service from that repository.
3. Build command: npm install
4. Start command: npm start
5. Add environment variables ADMIN_PASSWORD and ROOM_PASSWORD in Render's Environment settings.
6. Deploy. Render will give you a public URL like https://your-app.onrender.com. Share that URL with teams.
Note: free hosting may sleep when idle; allow a moment for it to wake.

LOCAL TEST
Install Node.js 18+.
From this folder run:
  npm install
  npm start
Then open http://localhost:3000 on your computer. To test from other devices on your Wi-Fi, use your computer's local IP and allow the port through the firewall. For internet-wide sharing, deploy to a host.

HOW TO PLAY
1. Open the public site.
2. Host enters name Mian Mahad Mahmood, the ROOM_PASSWORD, and ADMIN_PASSWORD.
3. Teams enter their team name and ROOM_PASSWORD, leaving Host password blank.
4. Host clicks Start game.
5. Teams select answers on their own devices.
6. Host clicks Reveal answer & award points, then Next question.
7. Everyone sees the same scores in real time.

SECURITY NOTE
The room password is shared by all invited teams, not unique accounts. Anyone who knows it can join. Do not reuse personal passwords. For a classroom quiz this is a simple access gate, not high-security authentication.
