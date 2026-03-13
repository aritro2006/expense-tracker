const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const auth = require("../middleware/authMiddleware");

/* GET TRANSACTIONS */

router.get("/",auth, async (req,res)=>{

try{

const transactions = await Transaction.find({user:req.user.id});

res.json(transactions);

}catch(err){

res.status(500).send("Server error");

}

});

/* ADD TRANSACTION */

router.post("/",auth, async (req,res)=>{

try{

const {text,amount} = req.body;

const transaction = new Transaction({

text,
amount,
user:req.user.id

});

const savedTransaction = await transaction.save();

res.json(savedTransaction);

}catch(err){

res.status(500).send("Server error");

}

});

/* DELETE */

router.delete("/:id",auth, async (req,res)=>{

try{

await Transaction.findByIdAndDelete(req.params.id);

res.json({message:"Transaction deleted"});

}catch(err){

res.status(500).send("Server error");

}

});

module.exports = router;