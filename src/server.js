import express from "express";
import cors from "cors";
import pg from "pg";

const server = express();
const { Pool } = pg;

server.use(express.json());
server.use(cors());

const connectionData = {
  user: 'postgres',
  password: '123456',
  host: 'localhost',
  port: 5432,
  database: 'boardcamp',
};

const pool = new Pool(connectionData);

server.get("/categories", (req, res) => {
    pool.query('SELECT * FROM categories').then((response) => {
        console.log(response);
        res.sendStatus(200);
    }).catch((error) => {
        console.log(error);
        res.sendStatus(500)
    });
    
});



server.listen(4000, () => {
  console.log("Servidor rodadndo na porta 4000");
});
