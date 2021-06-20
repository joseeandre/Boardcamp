var express = require("express");
var cors = require("cors");
var pg = require("pg");
var joi = require("joi");
var dayjs = require("dayjs");
const { query } = require("express");

const server = express();
const { Pool } = pg;

server.use(express.json());
server.use(cors());

const connectionData = {
  user: "postgres",
  password: "123456",
  host: "localhost",
  port: 5432,
  database: "boardcamp",
};

const pool = new Pool(connectionData);

const categoriesSchema = joi.object({
  name: joi.string().min(1).required(),
});

const gamesSchema = joi.object({
  name: joi.string().min(1).required(),
  image: joi.string().required(),
  stockTotal: joi.number().positive().required(),
  categoryId: joi.number().required(),
  pricePerDay: joi.number().positive().required(),
});

const customerSchema = joi.object({
  name: joi.string().min(1).required(),
  phone: joi.string().alphanum().min(10).max(11).required(),
  cpf: joi.string().alphanum().length(11).required(),
  birthday: joi.date().required(),
});

const rentalsSchema = joi.object({
  customerId: joi.number().required(),
  gameId: joi.number().required(),
  daysRented: joi.number().positive().required(),
});
// categories request

server.get("/categories", (req, res) => {
  pool
    .query("SELECT * FROM categories")
    .then((response) => {
      res.send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(500);
    });
});

server.post("/categories", async (req, res) => {
  if (categoriesSchema.validate(req.body).error !== undefined) {
    res.sendStatus(400);
  }

  const { name } = req.body;

  try {
    const categoriesCheck = await pool.query(
      "SELECT * FROM categories WHERE name = $1",
      [name]
    );

    if (categoriesCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await pool.query("INSERT INTO categories (name) VALUES ($1)", [name]);
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

// games request

server.get("/games", (req, res) => {
  let name = req.query.name !== undefined ? req.query.name : "";
  pool
    .query(
      `SELECT games.*, categories.name AS "categoryName" 
      FROM games JOIN categories ON games."categoryId" = categories.id WHERE LOWER(games.name) LIKE LOWER($1)`,
      [name + "%"]
    )
    .then((response) => {
      res.send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(500);
    });
});

server.post("/games", async (req, res) => {
  if (gamesSchema.validate(req.body).error !== undefined) {
    res.sendStatus(400);
  }

  const { name, image, stockTotal, categoryId, pricePerDay } = req.body;

  try {
    const idCheck = await pool.query("SELECT * FROM categories WHERE id = $1", [
      categoryId,
    ]);
    const nameCheck = await pool.query("SELECT * FROM games WHERE name = $1", [
      name,
    ]);

    if (idCheck.rows.length === 0) {
      return res.sendStatus(400);
    }

    if (nameCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await pool.query(
      `INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") 
      VALUES ($1, $2, $3, $4, $5)`,
      [name, image, stockTotal, categoryId, pricePerDay]
    );
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

// customers request

server.get("/customers", (req, res) => {
  let cpf = req.query.cpf !== undefined ? req.query.cpf : "";
  pool
    .query("SELECT * FROM customers WHERE customers.cpf LIKE ($1)", [cpf + "%"])
    .then((response) => {
      res.send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(500);
    });
});

server.get("/customers/:id", (req, res) => {
  var id = req.params.id;
  pool
    .query("SELECT * FROM customers WHERE customers.id = ($1)", [id])
    .then((response) => {
      if (response.rows === 0) {
        res.sendStatus(404);
      }
      res.send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(500);
    });
});

server.post("/customers", async (req, res) => {
  if (customerSchema.validate(req.body).error !== undefined) {
    res.sendStatus(400);
  }

  const { name, phone, cpf, birthday } = req.body;

  try {
    const cpfCheck = await pool.query(
      "SELECT * FROM customers WHERE cpf = $1",
      [cpf]
    );

    if (cpfCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await pool.query(
      "INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)",
      [name, phone, cpf, birthday]
    );
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

server.put("/customers/:id", async (req, res) => {
  var id = req.params.id;
  if (customerSchema.validate(req.body).error !== undefined) {
    res.sendStatus(400);
  }

  const { name, phone, cpf, birthday } = req.body;

  try {
    const cpfCheck = await pool.query(
      "SELECT * FROM customers WHERE cpf = $1",
      [cpf]
    );

    if (cpfCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await pool.query(
      `UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday = $4 
       WHERE customers.id = $5`,
      [name, phone, cpf, birthday, id]
    );
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

// rentals request

server.get("/rentals", (req, res) => {
  let { customerId, gameId } = req.query;
  let whereStatement = "";
  let queryVars = [];

  if (customerId !== undefined) {
    if (gameId !== undefined) {
      whereStatement =
        'WHERE rentals."customerId" = $1 AND rentals."gameId" = $2';
      queryVars = [customerId, gameId];
    } else {
      whereStatement = 'WHERE rentals."customerId" = $1';
      queryVars = [customerId];
    }
  } else if (gameId !== undefined) {
    whereStatement = 'WHERE rentals."gameId" = $1';
    queryVars = [gameId];
  }

  pool
    .query(
      `SELECT rentals.*, 
      jsonb_build_object('name', customers.name, 'id', customers.id) AS customer,
      jsonb_build_object('id', games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game            
      FROM rentals 
      JOIN customers ON rentals."customerId" = customers.id
      JOIN games ON rentals."gameId" = games.id
      JOIN categories ON categories.id = games."categoryId" 
      ` + whereStatement,
      queryVars
    )
    .then((response) => {
      res.send(response.rows);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(500);
    });
});

server.post("/rentals", async (req, res) => {
  if (rentalsSchema.validate(req.body).error !== undefined) {
    res.sendStatus(400);
  }

  const rentDate = dayjs().format("YYYY-MM-DD");
  const { customerId, gameId, daysRented } = req.body;

  try {
    const gamesRentCheck = await pool.query(
      `SELECT COUNT(*) FROM rentals WHERE rentals."gameId" = $1`,
      [gameId]
    );

    const gamesCheck = await pool.query(
      `SELECT "stockTotal", "pricePerDay" FROM games WHERE games.id = $1`,
      [gameId]
    );

    const originalPrice =
      parseInt(daysRented) * parseFloat(gamesCheck.rows[0].pricePerDay);

    const customerCheck = await pool.query(
      `SELECT * FROM customers WHERE customers.id = $1`,
      [customerId]
    );

    if (gamesCheck.rows.length === 0) {
      return res.sendStatus(400);
    }

    if (customerCheck.rows.length === 0) {
      return res.sendStatus(400);
    }

    if (
      parseInt(gamesRentCheck.rows.count) >
      parseInt(gamesCheck.rows[0].stockTotal)
    ) {
      return res.sendStatus(400);
    }

    await pool.query(
      `INSERT INTO rentals ("customerId", "gameId", "daysRented", "rentDate", "originalPrice") 
      VALUES ($1, $2, $3, $4, $5)`,
      [customerId, gameId, daysRented, rentDate, originalPrice]
    );

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

server.post("/rentals/:id/return", async (req, res) => {
  const rentalId = req.params.id;
  const returnDate = dayjs().format("YYYY-MM-DD");
  try {
    const rental = await pool.query(
      "SELECT * FROM rentals WHERE id = $1",
      [rentalId]
    );
    const rentDate = dayjs(rental.rows[0].rentDate).format("YYYY-MM-DD");
    const daysRented = rental.rows[0].daysRented;
    const pricePerDay = rental.rows[0].originalPrice / daysRented;
    const daysDiff = dayjs(returnDate).diff(rentDate, "hour") / 24;
    const isDelay = daysDiff > daysRented;
    const delayFee = isDelay ? (daysDiff - daysRented) * pricePerDay : 0;

    if (rental.rows.length === 0) {
      res.sendStatus(404);
      return;
    }
    if (rental.rows[0].returnDate !== null) {
      res.sendStatus(400);
      return;
    }

    res.sendStatus(200);
    await pool.query(
      `
          UPDATE rentals 
          SET "returnDate" = $1, "delayFee" = $2
          WHERE id = $3
      `,
      [returnDate, delayFee, rentalId]
    );
  } catch (error) {
    console.log(error);
    res.sendStatus(400);
  }
});

server.delete("/rentals/:id", async (req, res) => {
  const rentalId = req.params.id;
  try {
      const rental = await pool.query('SELECT * FROM rentals WHERE id = $1', [rentalId]);
      console.log(rental.rows);
      if(rental.rows.length === 0){
          res.sendStatus(404);
      }
      if(rental.rows[0].returnDate !== null){
          res.sendStatus(400);
      }
      await pool.query('DELETE FROM rentals WHERE rentals.id = $1', [rentalId]);

      res.sendStatus(200);
  } catch (error) {
      console.log(error);
      res.sendStatus(400);
  }
});

server.listen(4000, () => {
  console.log("Servidor rodando na porta 4000");
});
