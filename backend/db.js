import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "chatbot_db",
  password: "Goushiya@280677me",
  port: 5432
});

export default pool;