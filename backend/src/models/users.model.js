import mongoose from "mongoose";
import {  Schema } from "mongoose";

const userShema=new Schema({
    name:{type:String,requird:true},
    username:{type:String,requird:true,unique:true},
    password:{type:String,requird:true},
    token:{type:String}

})
const User=mongoose.model("User",userShema);
export default User