const mysql = require("mysql2/promise");

function createPoolFromEnv() {
  const {
    DB_HOST = "localhost",
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME = "sigeciss"
  } = process.env;

  return mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

module.exports = { createPoolFromEnv };

