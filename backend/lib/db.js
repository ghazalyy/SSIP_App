const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../dev.db');
const db = new Database(dbPath);

// Initialize Tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS Stock (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    sector TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS MarketData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stockSymbol TEXT,
    price REAL,
    change REAL,
    volume INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(stockSymbol) REFERENCES Stock(symbol)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS NewsItem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    source TEXT,
    url TEXT,
    summary TEXT,
    sentimentScore REAL,
    relatedTicker TEXT,
    publishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(relatedTicker) REFERENCES Stock(symbol)
  )
`).run();

module.exports = db;
