import User from "../models/users.model.js";
import Meeting from "../models/meeting.model.js";
import httpStatus from "http-status";
import bcrypt,{hash} from "bcrypt";
import crypto from "crypto";
export const register=async (req,res)=>{
    let{name,username,password}=req.body;
    try{
        const existingUser=await User.findOne({username});
        if(existingUser){
            return res.status(httpStatus.FOUND).json({message:"User already exist"});
        }
        const hashedPassword=await bcrypt.hash(password, 10);
         const newUser=new User({
            name:name,
            username:username,
            password:hashedPassword
         })
         await newUser.save();
         return res.status(httpStatus.CREATED).json({message:"User Registered"});
    }
    catch(e){
         return res.json({message:`something went wrong ${e}`});
    }

}
export const login=async (req,res)=>{
    let{username,password}=req.body;
    try{
        if (!username || !password) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "please enter username or password" })
        }
        const existingUser=await User.findOne({username});
        if(!existingUser){
            return res.status(httpStatus.NOT_FOUND).json({message:"User not exist"});
        }
        let isPasswordCorrect =await bcrypt.compare(password, existingUser.password)

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            existingUser.token = token;
            await existingUser.save();
            return res.status(httpStatus.OK).json({ token: token })
        }
        else{
             return res.status(httpStatus.UNAUTHORIZED).json({ message: "please enter correct username or password" });
        }

        
        
    }
    catch(e){
         return res.json({message:`something went wrong ${e}`});
    }

}

export const getUserHistory = async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token: token });
        const meetings = await Meeting.find({ userId: user.username })
        res.json(meetings)
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}

export const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    try {
        const user = await User.findOne({ token: token });

        const newMeeting = new Meeting({
            userId: user.username,
            meetingCode: meeting_code
        })

        await newMeeting.save();

        res.status(httpStatus.CREATED).json({ message: "Added code to history" })
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}