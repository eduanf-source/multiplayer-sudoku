const path=require("path");
const http=require("http");
const express=require("express");
const {Server}=require("socket.io");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map();

function code(){
  const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s;
  do{s=Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("")}while(rooms.has(s));
  return s;
}
function safeName(n,f){return String(n||f).trim().slice(0,20)||f}
function state(r){return {
  code:r.code, hostId:r.hostId, players:[...r.players.values()],
  started:r.started, puzzle:r.puzzle, board:r.board, solution:r.solution,
  scores:r.scores, difficulty:r.difficulty, startTime:r.startTime,
  finished:r.finished, winnerId:r.winnerId, chat:r.chat.slice(-50)
}}
function emit(r){io.to(r.code).emit("room:update",state(r))}
function solved(r){return r.started && r.board && r.board.every((v,i)=>v===r.solution[i])}

io.on("connection",s=>{
  s.on("room:create",({name},cb)=>{
    const c=code(), p={id:s.id,name:safeName(name,"Player 1"),slot:1,color:"green"};
    const r={code:c,players:new Map([[s.id,p]]),hostId:s.id,started:false,puzzle:null,board:null,solution:null,
      scores:{[s.id]:0},difficulty:"medium",startTime:null,finished:false,winnerId:null,chat:[]};
    rooms.set(c,r); s.join(c); s.data.room=c; cb({ok:true,code:c}); emit(r);
  });
  s.on("room:join",({code:raw,name},cb)=>{
    const c=String(raw||"").trim().toUpperCase(), r=rooms.get(c);
    if(!r)return cb({ok:false,error:"Private room not found."});
    if(r.players.size>=2)return cb({ok:false,error:"This private room is full."});
    const p={id:s.id,name:safeName(name,"Player 2"),slot:2,color:"red"};
    r.players.set(s.id,p); r.scores[s.id]=0; s.join(c); s.data.room=c; cb({ok:true,code:c}); emit(r);
  });
  s.on("game:start",({puzzle,solution,difficulty})=>{
    const r=rooms.get(s.data.room); if(!r||r.hostId!==s.id||r.players.size!==2)return;
    r.started=true;r.puzzle=puzzle;r.board=puzzle.slice();r.solution=solution;r.difficulty=difficulty||"medium";
    r.startTime=Date.now();r.finished=false;r.winnerId=null;
    for(const id of r.players.keys())r.scores[id]=0; emit(r);
  });
  s.on("game:move",({index,value})=>{
    const r=rooms.get(s.data.room); if(!r||!r.started||r.finished)return;
    if(!Number.isInteger(index)||index<0||index>80||r.puzzle[index]!==0)return;
    value=Number(value); if(value<0||value>9)return;
    const before=r.board[index], correct=value===r.solution[index];
    r.board[index]=value;
    if(correct && before!==r.solution[index])r.scores[s.id]=(r.scores[s.id]||0)+1;
    if(solved(r)){
      r.finished=true;
      const ranked=[...r.players.values()].sort((a,b)=>(r.scores[b.id]||0)-(r.scores[a.id]||0));
      r.winnerId=ranked[0].id;
    }
    emit(r);
  });
  s.on("chat:send",({text})=>{
    const r=rooms.get(s.data.room), p=r?.players.get(s.id); if(!r||!p)return;
    text=String(text||"").trim().slice(0,200); if(!text)return;
    r.chat.push({id:Date.now()+"-"+Math.random(),playerId:s.id,name:p.name,slot:p.slot,text,time:Date.now()}); emit(r);
  });
  s.on("game:rematch",({puzzle,solution,difficulty})=>{
    const r=rooms.get(s.data.room); if(!r||r.hostId!==s.id||r.players.size!==2)return;
    r.started=true;r.puzzle=puzzle;r.board=puzzle.slice();r.solution=solution;r.difficulty=difficulty||r.difficulty;
    r.startTime=Date.now();r.finished=false;r.winnerId=null;
    for(const id of r.players.keys())r.scores[id]=0; emit(r);
  });
  s.on("disconnect",()=>{
    const r=rooms.get(s.data.room); if(!r)return;
    r.players.delete(s.id);delete r.scores[s.id];
    if(!r.players.size){rooms.delete(r.code);return}
    r.hostId=[...r.players.keys()][0];r.started=false;r.finished=false;r.puzzle=r.board=r.solution=null;r.startTime=null;
    emit(r);
  });
});
server.listen(process.env.PORT||3000,()=>console.log("Sudoku Together v2 is running"));
