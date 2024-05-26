"use strict";

let mongodb = require("mongodb");
let mongoose = require("mongoose");
let XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

module.exports = function (app) {
  let uri ="mongodb+srv://datgrb123456:datgrb123456loL@cluster0.lztogta.mongodb.net/stock-price-checker?retryWrites=true&w=majority&appName=Cluster0";
  mongoose.connect(uri)
        .then(
    () => {
      console.log("Database connection established!");
    },
    (err) => {
      console.error("Database connection error:", err);
    }
            );

  let stockSchema = new mongoose.Schema
  ({
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    ips: [String],
  });

  let Stock = mongoose.model("Stock", stockSchema);

  app.route("/api/stock-prices").get(function (req, res) {
    let responseObject = {};
    responseObject["stockData"] = [];

    // Variable to determine number of stocks
    let twoStocks = false;

    /* Output Response */
    let outputResponse = () =>
    {
      return res.json(responseObject);
    };

    /* Find/Update Stock Document */
    let findOrUpdateStock = async (stockName, documentUpdate, nextStep) => {
      try {
        let stockDocument = await Stock.findOneAndUpdate(
          { name: stockName },
          documentUpdate,
          { new: true, upsert: true }
        );

        if (stockDocument) {
          return nextStep(stockDocument);
        }
      } catch (error) {
        console.log(error);
      }
    };

    /* Like Stock */
    let likeStock = async (stockName, nextStep, req, res) => {
      try {
        const stockDocument = await Stock.findOne({ name: stockName });

        if (
          stockDocument &&
          stockDocument['ips'] &&
          stockDocument['ips'].includes(req.ip)
        ) {
          return res.json("Only 1 Like per IP Allowed!!");
        } else {
          const documentUpdate = { $inc: { likes: 1 }, $push: { ips: req.ip } };
          await nextStep(stockName, documentUpdate, getPrice);
        }
      } catch (error) {
        console.error(error);
      }
    };

    /* Get Price */
    let getPrice = (stockDocument) => {
      let xhr = new XMLHttpRequest();
      let requestUrl =
        "https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" + stockDocument["name"] + "/quote";
      xhr.open("GET", requestUrl, true);
      xhr.onload = () => {
        let apiResponse = JSON.parse(xhr.responseText);
        stockDocument["price"] = apiResponse["latestPrice"].toFixed(2);
        if (twoStocks) {
          processTwoStocks(stockDocument);
        } else {
          processOneStock(stockDocument);
        }
      };
      xhr.send();
    };

    /* Build Response for 1 Stock */
    let processOneStock = (stockDocument) => {
      responseObject["stockData"] = {
        stock: stockDocument["name"],
        price: stockDocument["price"],
        likes: stockDocument["likes"],
      };
      outputResponse();
    };

    let stocks = [];
    /* Build Response for 2 Stocks */
    let processTwoStocks = (stockDocument) => {
      let newStock = {
        stock: stockDocument["name"],
        price: stockDocument["price"],
        likes: stockDocument["likes"],
      };
      stocks.push(newStock);
      if (stocks.length === 2) {
        stocks[0]["rel_likes"] = stocks[0]["likes"] - stocks[1]["likes"];
        stocks[1]["rel_likes"] = stocks[1]["likes"] - stocks[0]["likes"];
        responseObject["stockData"] = stocks;
        outputResponse();
      }
    };

    /* Process Input */
    if (typeof req.query.stock === "string") {
      /* One Stock */
      let stockName = req.query.stock;

      let documentUpdate = {};
      if (req.query.like && req.query.like === "true") {
        likeStock(stockName, findOrUpdateStock, req, res);
      } else {
        findOrUpdateStock(stockName, documentUpdate, getPrice);
      }
    } else if (Array.isArray(req.query.stock)) {
      twoStocks = true;
      /* Stock 1 */
      let stockName = req.query.stock[0];
      if (req.query.like && req.query.like === "true") {
        likeStock(stockName, findOrUpdateStock, req, res);
      } else {
        findOrUpdateStock(stockName, {}, getPrice);
      }

      /* Stock 2 */
      stockName = req.query.stock[1];
      if (req.query.like && req.query.like === "true") {
        likeStock(stockName, findOrUpdateStock, req, res);
      } else {
        findOrUpdateStock(stockName, {}, getPrice);
      }
    }
  });
};