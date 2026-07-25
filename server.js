// npx.cmd nodemon server.js
// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const socketHandler = require("./server/socket");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(__dirname + "/server/public"));
app.get("/", (req,res)=>{ res.sendFile(__dirname + "/server/public/index.html");});
socketHandler(io);
server.listen(3000, ()=>{console.log("Werewords running at http://localhost:3000");});

