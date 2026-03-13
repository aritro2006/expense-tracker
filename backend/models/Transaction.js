const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({

  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  text:{
    type:String,
    required:true
  },

  amount:{
    type:Number,
    required:true
  },

  date:{
    type:Date,
    default:Date.now
  }

});

/* IMPORTANT FIX */

module.exports =
mongoose.models.Transaction ||
mongoose.model("Transaction", TransactionSchema);