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
 {cat:"IT BASICS",q:"Which computer part is often called the brain of the computer?",a:["CPU","SSD","Keyboard","Power supply"],c:0,why:"The CPU processes instructions and data."},
 {cat:"NETWORKING",q:"What does DNS help your computer do?",a:["Turn website names into IP addresses","Make the screen brighter","Charge the battery faster","Block every virus"],c:0,why:"DNS resolves domain names to IP addresses."},
 {cat:"IT BASICS",q:"What does RAM mainly store while programs are running?",a:["Temporary working data","Files forever without power","Printed pages","Wi-Fi passwords only"],c:0,why:"RAM is fast, temporary memory for active programs."},
 {cat:"NETWORKING",q:"Which of these is a private IPv4 address?",a:["8.8.8.8","172.20.5.4","1.1.1.1","193.10.1.5"],c:1,why:"172.20.5.4 is in the private 172.16.0.0–172.31.255.255 range."},
 {cat:"NETWORKING",q:"Which device forwards data between different IP networks?",a:["Router","Mouse","Monitor","Webcam"],c:0,why:"Routers forward packets between networks."},
 {cat:"CYBER SAFETY",q:"An unexpected email asks for your password. What is safest?",a:["Reply with the password","Click every link","Report it and verify the sender","Forward it to everyone"],c:2,why:"Unexpected password requests can be phishing."},
 {cat:"FUNNY TECH",q:"Your computer says “I need a break!” What should you do first in real life?",a:["Give it a tiny coffee","Check whether it is overheating or overloaded","Put it in the fridge","Ask it to do homework"],c:1,why:"Checking heat and workload is sensible troubleshooting."},
 {cat:"FUNNY TECH",q:"The Wi-Fi disappears just before your online test. Best first move?",a:["Blame the moon","Check the Wi-Fi connection and router","Throw the laptop out the window","Rename the network “Please Work”"],c:1,why:"Start with basic connection checks."},
 {cat:"IT BASICS",q:"Which number system uses only 0 and 1?",a:["Decimal","Binary","Hexadecimal","Roman numerals"],c:1,why:"Binary is base 2 and uses 0 and 1."},
 {cat:"FUNNY TECH",q:"What is a computer’s favourite snack?",a:["Microchips","Motherboard pizza","USB spaghetti","Cloud cookies only"],c:0,why:"Microchips! It’s a tech pun."},
 {cat:"NETWORKING",q:"What does DHCP commonly do on a network?",a:["Automatically assigns IP settings","Edits photos","Repairs broken screens","Encrypts every file by itself"],c:0,why:"DHCP can automatically assign IP addresses and other settings."},
 {cat:"FUNNY TECH",q:"A student has 100 tabs open and the laptop is slow. Sensible advice?",a:["Open 100 more","Close tabs and check resource usage","Shake the laptop","Turn brightness to maximum"],c:1,why:"Many tabs can consume memory and processing resources."},
 {cat:"IT BASICS",q:"Which one is an operating system?",a:["Windows","HDMI","Ethernet cable","USB port"],c:0,why:"Windows is an operating system."},
 {cat:"FUNNY TECH",q:"Why did the computer go to the doctor?",a:["It caught a virus","It lost its shoes","It ate too much pizza","It forgot its birthday"],c:0,why:"A classic computer joke: it caught a virus!"},
 {cat:"CYBER SAFETY",q:"Which is a good account-security habit?",a:["Use one simple password everywhere","Share passwords with classmates","Use unique passwords and multifactor authentication","Write your password on the wall"],c:2,why:"Unique passwords and multifactor authentication improve account security."},
 {cat:"FINAL BOSS",q:"BONUS: What should the class do with the funniest router joke?",a:["Vote for the funniest answer","Restart the classroom","Hide the router","Change every password"],c:0,why:"Let the class vote for the funniest answer!"}
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
     a: state.revealed ? questions[state.questionIndex].a : null,
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
