import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import  {connectToSocket}  from "./controllers/Socketmanager.js";
import userRoutes from "./routes/users.routes.js"
import { userInfo } from "node:os";
const app=express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8000));
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));
app.use("/",userRoutes)

app.get("/",(req,res)=>{
    res.send("Hello world");
})

const start=async()=>{
    app.set("mongo_user")
    const connectionDb=await mongoose.connect("mongodb+srv://yashrm2005:OmZuAAvCdVedjEbP@cluster0.f56ggat.mongodb.net/vidstack?retryWrites=true&w=majority&tls=true");
    console.log(`Mongo connected DB host: ${connectionDb.connection.host}`)
    server.listen(app.get("port"),()=>{
    console.log("server listening");
})
}
start();
