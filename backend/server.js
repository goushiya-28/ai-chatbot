import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import pool from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* CREATE CHAT */

app.post("/new-chat", async (req,res)=>{

  const result = await pool.query(
    "INSERT INTO conversations(title) VALUES('New Chat') RETURNING id"
  );

  res.json({conversation_id:result.rows[0].id});

});


/* GET CHATS */

app.get("/conversations", async (req,res)=>{

  const result = await pool.query(
    "SELECT id,title FROM conversations ORDER BY id"
  );

  res.json(result.rows);

});


/* DELETE CHAT */

app.delete("/conversation/:id", async(req,res)=>{

  const id=req.params.id;

  await pool.query(
    "DELETE FROM messages WHERE conversation_id=$1",[id]
  );

  await pool.query(
    "DELETE FROM conversations WHERE id=$1",[id]
  );

  res.json({success:true});

});


/* CHAT */

app.post("/chat", async (req,res)=>{

try{

const {message,conversation_id}=req.body;

/* SAVE USER MESSAGE */

await pool.query(
"INSERT INTO messages(conversation_id,role,content) VALUES($1,$2,$3)",
[conversation_id,"user",message]
);


/* SET TITLE FROM FIRST MESSAGE */

const first=await pool.query(
"SELECT COUNT(*) FROM messages WHERE conversation_id=$1",
[conversation_id]
);

if(first.rows[0].count==1){

const title=message.substring(0,30);

await pool.query(
"UPDATE conversations SET title=$1 WHERE id=$2",
[title,conversation_id]
);

}


/* DATE QUESTIONS HANDLED BY SERVER */

const lower=message.toLowerCase();

if(lower.includes("date")||lower.includes("today")){

const now=new Date();

const reply=`Today's date is ${now.getDate()} ${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()} (${now.toLocaleString('default',{weekday:'long'})}).`;

await pool.query(
"INSERT INTO messages(conversation_id,role,content) VALUES($1,$2,$3)",
[conversation_id,"assistant",reply]
);

return res.json({reply});

}


/* HISTORY */

const history=await pool.query(
"SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 20",
[conversation_id]
);


/* AI RESPONSE */

const response=await groq.chat.completions.create({

model:"llama-3.1-8b-instant",

messages:history.rows.reverse()

});


const reply=response.choices[0].message.content;


/* SAVE BOT MESSAGE */

await pool.query(
"INSERT INTO messages(conversation_id,role,content) VALUES($1,$2,$3)",
[conversation_id,"assistant",reply]
);

res.json({reply});


}catch(err){

console.log(err);

res.status(500).json({error:"AI failed"});

}

});


/* HISTORY */

app.get("/history/:id", async (req,res)=>{

const result=await pool.query(
"SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY id",
[req.params.id]
);

res.json(result.rows);

});


app.listen(3001,()=>{
console.log("server running on port 3001");
});