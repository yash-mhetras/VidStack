import mongoose, {  Schema } from "mongoose";
const meetingShema=new Schema({
    userId:{type:String},
    meetingCode:{type:String,required:true},
    date:{type:Date,default:Date.now(),required:true}

})
const Meeting=mongoose.model("Meeting",meetingShema);
export default Meeting;