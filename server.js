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
 {cat:"IPV4 & SUBNETTING",q:"Ein Netzwerk nutzt 192.168.10.0/26. Wie viele nutzbare Host-Adressen gibt es pro Subnetz?",a:["30","62","64","126"],c:1,why:"Bei /26 bleiben 6 Host-Bits: 2^6 − 2 = 62 nutzbare Host-Adressen."},
 {cat:"IPV4 & SUBNETTING",q:"Welche Subnetzmaske entspricht dem Präfix /27?",a:["255.255.255.0","255.255.255.128","255.255.255.224","255.255.255.240"],c:2,why:"/27 bedeutet 27 gesetzte Bits: 255.255.255.224."},
 {cat:"IPV4 & SUBNETTING",q:"Welche Adresse liegt im privaten IPv4-Bereich?",a:["172.32.1.10","172.20.1.10","172.15.1.10","172.40.1.10"],c:1,why:"Der private Bereich reicht von 172.16.0.0 bis 172.31.255.255."},
 {cat:"IPV4 & SUBNETTING",q:"Ein PC hat 192.168.1.70/26. Zu welchem Netzwerk gehört er?",a:["192.168.1.0","192.168.1.64","192.168.1.70","192.168.1.128"],c:1,why:"Ein /26-Subnetz hat Blockgrößen von 64. Die Adresse 70 liegt im Bereich 64–127."},
 {cat:"IPV4 & SUBNETTING",q:"Welche IPv4-Adresse ist die Broadcast-Adresse für 192.168.5.0/24?",a:["192.168.5.0","192.168.5.1","192.168.5.254","192.168.5.255"],c:3,why:"Bei einem /24-Netz ist die letzte Adresse .255 die Broadcast-Adresse."},
 {cat:"BINÄR & HEX",q:"Welche Dezimalzahl entspricht 10110110₂?",a:["166","174","182","190"],c:2,why:"128 + 32 + 16 + 4 + 2 = 182."},
 {cat:"BINÄR & HEX",q:"Welche Dezimalzahl entspricht 3A₁₆?",a:["48","56","58","60"],c:2,why:"3 × 16 + 10 = 58."},
 {cat:"BINÄR & HEX",q:"Welche Hexadezimalzahl entspricht 254₁₀?",a:["EF","F0","FE","FF"],c:2,why:"254 geteilt durch 16 ergibt 15 Rest 14, also FE."},
 {cat:"CISCO IOS",q:"Welcher Befehl wechselt vom User-EXEC-Modus in den Privileged-EXEC-Modus?",a:["configure terminal","enable","login","interface vlan 1"],c:1,why:"Mit enable wechselt man zu Switch# beziehungsweise Router#."},
 {cat:"CISCO IOS",q:"In welchem Modus wird hostname Router1 konfiguriert?",a:["User-EXEC-Modus","Privileged-EXEC-Modus","Global Configuration Mode","ROMMON"],c:2,why:"Der hostname-Befehl wird im globalen Konfigurationsmodus eingegeben."},
 {cat:"CISCO IOS",q:"Welcher Befehl speichert die laufende Konfiguration dauerhaft in NVRAM?",a:["copy startup-config running-config","write erase","copy running-config startup-config","reload"],c:2,why:"Damit wird running-config als startup-config gespeichert."},
 {cat:"CISCO IOS",q:"Welche Aussage zu RAM und NVRAM ist richtig?",a:["RAM speichert die Startkonfiguration dauerhaft","NVRAM enthält normalerweise die startup-config","NVRAM ist flüchtiger Arbeitsspeicher","RAM enthält nur das IOS-Image dauerhaft"],c:1,why:"Die startup-config wird normalerweise im nichtflüchtigen NVRAM gespeichert."},
 {cat:"NETZWERKPROTOKOLLE",q:"Welches Protokoll übersetzt einen Domainnamen wie beispiel.de in eine IP-Adresse?",a:["DHCP","DNS","FTP","ARP"],c:1,why:"DNS löst Domainnamen in IP-Adressen auf."},
 {cat:"NETZWERKPROTOKOLLE",q:"Welches Protokoll weist Clients häufig automatisch IP-Adressen zu?",a:["DHCP","ICMP","SSH","SMTP"],c:0,why:"DHCP vergibt automatisch IP-Konfigurationen wie Adresse, Gateway und DNS-Server."},
 {cat:"OSI-MODELL",q:"Auf welcher OSI-Schicht arbeitet ein gewöhnlicher Ethernet-Switch hauptsächlich?",a:["Schicht 1 – Bitübertragung","Schicht 2 – Sicherung","Schicht 3 – Vermittlung","Schicht 7 – Anwendung"],c:1,why:"Ein Layer-2-Switch leitet Frames anhand von MAC-Adressen weiter."},
 {cat:"OSI-MODELL",q:"Welche OSI-Schicht ist hauptsächlich für Routing zwischen IP-Netzwerken zuständig?",a:["Schicht 2","Schicht 3","Schicht 4","Schicht 6"],c:1,why:"Routing gehört zur Vermittlungsschicht (Layer 3)." },
 {cat:"FEHLERSUCHE",q:"Ein PC kann 8.8.8.8 erreichen, aber keine Webseitennamen öffnen. Was sollte man zuerst prüfen?",a:["DNS-Konfiguration","Monitorkabel","Tastaturlayout","Druckertreiber"],c:0,why:"Wenn IP-Verbindungen funktionieren, aber Namen nicht, ist DNS ein naheliegender Prüfpunkt."},
 {cat:"FEHLERSUCHE",q:"Ein PC hat die IP-Adresse 169.254.12.8 erhalten. Was deutet das meistens an?",a:["DHCP konnte keine Adresse vergeben","Der PC hat eine öffentliche IP","DNS funktioniert perfekt","Der Router hat IPv6 deaktiviert"],c:0,why:"Eine 169.254.x.x-Adresse ist eine link-lokale IPv4-Adresse, die oft bei fehlgeschlagenem DHCP erscheint."},
 {cat:"CYBERSICHERHEIT",q:"Was schützt ein Konto zusätzlich zum Passwort am besten?",a:["Dasselbe Passwort überall verwenden","Mehr-Faktor-Authentifizierung","Passwort im Klassengruppenchat teilen","Alle Sicherheitsupdates deaktivieren"],c:1,why:"Mehr-Faktor-Authentifizierung verlangt einen zusätzlichen Nachweis neben dem Passwort."},
 {cat:"CYBERSICHERHEIT",q:"Welche Aussage beschreibt Phishing am besten?",a:["Ein Verfahren zum Kühlen der CPU","Ein Angriff, bei dem gefälschte Nachrichten Daten stehlen sollen","Ein Ethernet-Kabelstandard","Eine Methode zur Festplattenformatierung"],c:1,why:"Phishing täuscht Nutzer, damit sie Passwörter, Zahlungsdaten oder andere Informationen preisgeben."},
 {cat:"ENDGEGNER",q:"Ein Gerät mit 192.168.1.10/24 möchte 192.168.2.20 erreichen. Was benötigt es normalerweise, um das andere Netzwerk zu erreichen?",a:["Einen Standard-Gateway/Router","Nur eine andere MAC-Adresse selbst wählen","Eine größere Bildschirmauflösung","Den DNS-Server als Netzwerkkabel"],c:0,why:"Ziele außerhalb des eigenen Subnetzes werden normalerweise an den Standard-Gateway gesendet."}
];


let activeQuestions = [...questions];
let previousQuestionOrder = [];
function shuffleQuestionsForNewGame(){
 const order = [...questions];
 for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 if(previousQuestionOrder.length===order.length && order.every((q,i)=>q===previousQuestionOrder[i])){
   [order[0],order[1]]=[order[1],order[0]];
 }
 if(previousQuestionOrder.length && order[0]===previousQuestionOrder[0]){
   const j=order.findIndex(q=>q!==previousQuestionOrder[0]);
   if(j>0)[order[0],order[j]]=[order[j],order[0]];
 }
 activeQuestions=order;
 previousQuestionOrder=[...order];
}

const QUESTION_SECONDS = 60;
let questionTimer = null;
let state = { roomOpen:false, gameStarted:false, questionIndex:-1, revealed:false, questionEndsAt:null, teams:{}, answers:{} };
const clients = new Map();
function stopQuestionTimer(){ if(questionTimer){clearTimeout(questionTimer);questionTimer=null;} }
function beginQuestionTimer(){
 stopQuestionTimer();
 state.questionEndsAt = Date.now() + QUESTION_SECONDS * 1000;
 questionTimer = setTimeout(() => { if(state.gameStarted && !state.revealed && state.questionIndex >= 0){ revealAnswer(); } }, QUESTION_SECONDS * 1000);
}
function revealAnswer(){
 if(state.revealed || state.questionIndex < 0) return;
 stopQuestionTimer();
 state.revealed = true;
 state.questionEndsAt = null;
 const correct = activeQuestions[state.questionIndex].c;
 for(const [id,a] of Object.entries(state.answers)){
   if(a.choice === correct && state.teams[id] && !a.scored){ state.teams[id].score += 100; a.scored = true; }
 }
 broadcast();
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast() {
 const safe = {
   roomOpen: state.roomOpen, gameStarted: state.gameStarted,
   questionIndex: state.questionIndex, revealed: state.revealed,
   teams: Object.values(state.teams).map(t=>({id:t.id,name:t.name,score:t.score,isHost:t.isHost})),
   answers: Object.fromEntries(Object.entries(state.answers).map(([id,a])=>[id,{submitted:true,choice:a.choice}])),
   secondsLeft: state.questionEndsAt ? Math.max(0, Math.ceil((state.questionEndsAt-Date.now())/1000)) : 0,
   question: state.questionIndex >= 0 ? {
     cat: activeQuestions[state.questionIndex].cat, q: activeQuestions[state.questionIndex].q,
     a: activeQuestions[state.questionIndex].a,
     c: state.revealed ? activeQuestions[state.questionIndex].c : null,
     why: state.revealed ? activeQuestions[state.questionIndex].why : null,
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
    shuffleQuestionsForNewGame(); state.gameStarted=true; state.questionIndex=0; state.revealed=false; state.answers={}; beginQuestionTimer(); broadcast();
   } else if (m.type==="reveal" && team.isHost && state.questionIndex>=0) {
    revealAnswer();
   } else if (m.type==="next" && team.isHost) {
    stopQuestionTimer();
    if (state.questionIndex+1 >= questions.length) { state.gameStarted=false; state.questionIndex=-2; state.revealed=false; state.questionEndsAt=null; broadcast(); }
    else { state.questionIndex++; state.revealed=false; state.answers={}; beginQuestionTimer(); broadcast(); }
   } else if (m.type==="answer" && state.gameStarted && !state.revealed && state.questionIndex>=0 && Number.isInteger(m.choice) && m.choice>=0 && m.choice<4) {
    // Let the participant change their choice until the timer expires or the host reveals.
    // The latest choice replaces the previous one; points are awarded only once at reveal.
    state.answers[team.id]={choice:m.choice,scored:false};
    broadcast();
   } else if (m.type==="reset" && team.isHost) {
    stopQuestionTimer();
    state={roomOpen:true,gameStarted:false,questionIndex:-1,revealed:false,questionEndsAt:null,teams:Object.fromEntries(Object.values(state.teams).map(t=>[t.id,{...t,score:0}])),answers:{}};
    broadcast();
   }
  }
 });
 ws.on("close",()=>{const id=ws.teamId;if(id && state.teams[id] && !state.teams[id].isHost){delete state.teams[id];delete state.answers[id];broadcast()}});
});
server.listen(PORT,()=>console.log(`IT Showdown running on port ${PORT}`));
