const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// Set these environment variables on your hosting service.
// ADMIN_PASSWORD is the private host password you share only with selected people.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe-201";
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || "Classroom-201";

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

const questions = [
 {cat:"IT-GRUNDLAGEN",q:"Welcher Computerbestandteil wird oft als Gehirn des Computers bezeichnet?",a:["CPU / Prozessor","SSD","Tastatur","Netzteil"],c:0,why:"Die CPU verarbeitet Befehle und Daten."},
 {cat:"NETZWERKE",q:"Wobei hilft DNS deinem Computer?",a:["Websitenamen in IP-Adressen umzuwandeln","Den Bildschirm heller zu machen","Den Akku schneller aufzuladen","Jeden Virus zu blockieren"],c:0,why:"DNS löst Domainnamen in IP-Adressen auf."},
 {cat:"IT-GRUNDLAGEN",q:"Was speichert RAM hauptsächlich, während Programme laufen?",a:["Vorübergehende Arbeitsdaten","Dateien dauerhaft ohne Strom","Gedruckte Seiten","Nur WLAN-Passwörter"],c:0,why:"RAM ist ein schneller, temporärer Speicher für aktive Programme."},
 {cat:"NETZWERKE",q:"Welche dieser Adressen ist eine private IPv4-Adresse?",a:["8.8.8.8","172.20.5.4","1.1.1.1","193.10.1.5"],c:1,why:"172.20.5.4 liegt im privaten Bereich 172.16.0.0–172.31.255.255."},
 {cat:"NETZWERKE",q:"Welches Gerät leitet Daten zwischen verschiedenen IP-Netzwerken weiter?",a:["Router","Maus","Monitor","Webcam"],c:0,why:"Router leiten Datenpakete zwischen Netzwerken weiter."},
 {cat:"CYBERSICHERHEIT",q:"Eine unerwartete E-Mail fragt nach deinem Passwort. Was ist am sichersten?",a:["Mit dem Passwort antworten","Auf jeden Link klicken","Die Nachricht melden und den Absender überprüfen","Sie an alle weiterleiten"],c:2,why:"Unerwartete Passwortanfragen können Phishing sein."},
 {cat:"TECH-HUMOR",q:"Dein Computer sagt: „Ich brauche eine Pause!“ Was solltest du zuerst tun?",a:["Ihm einen kleinen Kaffee geben","Prüfen, ob er überhitzt oder überlastet ist","Ihn in den Kühlschrank legen","Ihn die Hausaufgaben machen lassen"],c:1,why:"Temperatur und Auslastung zu prüfen, ist eine sinnvolle Fehlersuche."},
 {cat:"TECH-HUMOR",q:"Das WLAN verschwindet kurz vor deinem Online-Test. Was ist der beste erste Schritt?",a:["Den Mond beschuldigen","WLAN-Verbindung und Router überprüfen","Den Laptop aus dem Fenster werfen","Das Netzwerk in „Bitte funktionieren“ umbenennen"],c:1,why:"Beginne mit den grundlegenden Verbindungsprüfungen."},
 {cat:"IT-GRUNDLAGEN",q:"Welches Zahlensystem verwendet nur 0 und 1?",a:["Dezimalsystem","Binärsystem","Hexadezimalsystem","Römische Zahlen"],c:1,why:"Das Binärsystem hat die Basis 2 und verwendet 0 und 1."},
 {cat:"TECH-HUMOR",q:"Was ist der Lieblingssnack eines Computers?",a:["Mikrochips","Mainboard-Pizza","USB-Spaghetti","Nur Cloud-Kekse"],c:0,why:"Mikrochips – ein Wortspiel aus der Technik!"},
 {cat:"NETZWERKE",q:"Was macht DHCP üblicherweise in einem Netzwerk?",a:["IP-Einstellungen automatisch zuweisen","Fotos bearbeiten","Kaputte Bildschirme reparieren","Jede Datei selbstständig verschlüsseln"],c:0,why:"DHCP kann IP-Adressen und weitere Netzwerkeinstellungen automatisch zuweisen."},
 {cat:"TECH-HUMOR",q:"Ein Schüler hat 100 Tabs offen und der Laptop ist langsam. Was ist ein sinnvoller Rat?",a:["Noch 100 öffnen","Tabs schließen und die Ressourcennutzung prüfen","Den Laptop schütteln","Die Helligkeit auf Maximum stellen"],c:1,why:"Viele Tabs können Speicher und Rechenleistung beanspruchen."},
 {cat:"IT-GRUNDLAGEN",q:"Was davon ist ein Betriebssystem?",a:["Windows","HDMI","Ethernetkabel","USB-Anschluss"],c:0,why:"Windows ist ein Betriebssystem."},
 {cat:"TECH-HUMOR",q:"Warum ging der Computer zum Arzt?",a:["Er hatte einen Virus","Er hatte seine Schuhe verloren","Er hatte zu viel Pizza gegessen","Er hatte seinen Geburtstag vergessen"],c:0,why:"Ein klassischer Computerwitz: Er hatte einen Virus!"},
 {cat:"CYBERSICHERHEIT",q:"Welche Gewohnheit verbessert die Kontosicherheit?",a:["Ein einfaches Passwort überall verwenden","Passwörter mit Mitschülern teilen","Einzigartige Passwörter und Mehr-Faktor-Authentifizierung verwenden","Das Passwort an die Wand schreiben"],c:2,why:"Einzigartige Passwörter und Mehr-Faktor-Authentifizierung erhöhen die Sicherheit."},
 {cat:"ENDGEGNER",q:"BONUS: Was soll die Klasse mit dem lustigsten Router-Witz machen?",a:["Über die lustigste Antwort abstimmen","Das Klassenzimmer neu starten","Den Router verstecken","Alle Passwörter ändern"],c:0,why:"Lasst die Klasse über den lustigsten Witz abstimmen!"}
];

let state = { roomOpen:false, gameStarted:false, questionIndex:-1, revealed:false, teams:{}, answers:{} };
const clients = new Map();
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast() {
 const safe = {
   roomOpen: state.roomOpen, gameStarted: state.gameStarted,
   questionIndex: state.questionIndex, revealed: state.revealed,
   teams: Object.values(state.teams).map(t=>({id:t.id,name:t.name,score:t.score,isHost:t.isHost})),
   answers: Object.fromEntries(Object.entries(state.answers).map(([id,a])=>[id,{submitted:true}])),
   question: state.questionIndex >= 0 ? {
     cat: questions[state.questionIndex].cat, q: questions[state.questionIndex].q,
     a: questions[state.questionIndex].a,
     c: state.revealed ? questions[state.questionIndex].c : null,
     why: state.revealed ? questions[state.questionIndex].why : null,
     total: questions.length, number: state.questionIndex+1
   } : null
 };
 for (const ws of wss.clients) send(ws, {type:"state", state:safe});
}
function fail(ws, message) { send(ws,{type:"error",message}); }

wss.on("connection", ws => {
 ws.on("message", raw => {
  let m; try { m=JSON.parse(raw.toString()); } catch { return fail(ws,"Invalid message."); }
  if (m.type === "join") {
   if (m.password !== ROOM_PASSWORD) return fail(ws,"That room password is incorrect.");
   const name = String(m.name || "Team").trim().slice(0,28) || "Team";
   const isHost = m.hostPassword === ADMIN_PASSWORD;
   if (!state.roomOpen) {
    if (!isHost) return fail(ws,"The host has not opened the room yet. Ask Mahad to start it.");
    state.roomOpen=true;
   }
   if (isHost) {
    const existing = Object.values(state.teams).find(t=>t.isHost);
    if (existing) { ws.teamId=existing.id; clients.set(ws,existing.id); send(ws,{type:"joined",teamId:existing.id,isHost:true}); return broadcast(); }
   }
   const id=crypto.randomBytes(5).toString("hex");
   state.teams[id]={id,name,score:0,isHost};
   ws.teamId=id; clients.set(ws,id);
   send(ws,{type:"joined",teamId:id,isHost});
   broadcast();
  } else {
   const team=state.teams[ws.teamId];
   if (!team) return fail(ws,"Join the room first.");
   if (m.type==="start" && team.isHost) {
    state.gameStarted=true; state.questionIndex=0; state.revealed=false; state.answers={}; broadcast();
   } else if (m.type==="reveal" && team.isHost && state.questionIndex>=0) {
    state.revealed=true;
    const correct=questions[state.questionIndex].c;
    for (const [id,a] of Object.entries(state.answers)) if (a.choice===correct && state.teams[id]) state.teams[id].score+=100;
    broadcast();
   } else if (m.type==="next" && team.isHost) {
    if (state.questionIndex+1 >= questions.length) { state.gameStarted=false; state.questionIndex=-2; broadcast(); }
    else { state.questionIndex++; state.revealed=false; state.answers={}; broadcast(); }
   } else if (m.type==="answer" && state.gameStarted && !state.revealed && state.questionIndex>=0 && Number.isInteger(m.choice) && m.choice>=0 && m.choice<4) {
    state.answers[team.id]={choice:m.choice};
    broadcast();
   } else if (m.type==="reset" && team.isHost) {
    state={roomOpen:true,gameStarted:false,questionIndex:-1,revealed:false,teams:Object.fromEntries(Object.values(state.teams).map(t=>[t.id,{...t,score:0}])),answers:{}};
    broadcast();
   }
  }
 });
 ws.on("close",()=>{const id=ws.teamId;if(id && state.teams[id] && !state.teams[id].isHost){delete state.teams[id];delete state.answers[id];broadcast()}});
});
server.listen(PORT,()=>console.log(`IT Showdown running on port ${PORT}`));
