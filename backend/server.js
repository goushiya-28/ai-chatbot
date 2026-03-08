import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import pool from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// middleware
app.use(cors());
app.use(express.json());

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});


// create new conversation
app.post("/new-chat", async (req, res) => {
  try {

    const result = await pool.query(
      "INSERT INTO conversations DEFAULT VALUES RETURNING id"
    );

    res.json({
      conversation_id: result.rows[0].id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});


// get conversation history
app.get("/history/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const result = await pool.query(
      "SELECT role, content FROM messages WHERE conversation_id=$1 ORDER BY id",
      [id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }

});


// chat endpoint
app.post("/chat", async (req, res) => {

  try {

    const { message, conversation_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    // save user message
    await pool.query(
      "INSERT INTO messages(conversation_id,role,content) VALUES($1,$2,$3)",
      [conversation_id, "user", message]
    );


    // get conversation history
    const history = await pool.query(
      "SELECT role,content FROM messages WHERE conversation_id=$1 ORDER BY id",
      [conversation_id]
    );

    const messages = history.rows.map(m => ({
      role: m.role,
      content: m.content
    }));


    // call Groq AI
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messages
    });

    const reply = completion.choices[0].message.content;


    // save AI reply
    await pool.query(
      "INSERT INTO messages(conversation_id,role,content) VALUES($1,$2,$3)",
      [conversation_id, "assistant", reply]
    );


    res.json({ reply });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "AI response failed" });

  }

});


// health check
app.get("/", (req, res) => {
  res.send("AI chatbot backend running");
});


// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});