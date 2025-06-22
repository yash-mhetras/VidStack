import React from 'react';
import { useState,useContext } from 'react';
import WithAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext.jsx';


function Homecomponent() {


    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const {addToUserHistory} = useContext(AuthContext);
    let handlevideocall=async ()=>{
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`)

    }



    return (
        <>
            <div style={{background:"linear-gradient(90deg, #e3ffe7 0%, #d9e7ff 100%)"}} className='main'>
            <div className="navBar">

                <div style={{ display: "flex", alignItems: "center" }}>

                    <h2>VidStack</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={()=>navigate("/history")}
                    >
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    <Button onClick={() => {
                        localStorage.removeItem("token")
                        navigate("/auth")
                    }}>
                        Logout
                    </Button>
                </div>


            </div>


            <div className="meetContainer">
                <div className="leftPanel">
                    <div className='leftsub'>
                        <h2>Providing Quality Video Call Just Like Quality Education</h2>

                        <div style={{ display: 'flex', gap: "10px" }}>

                            <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
                            <Button  variant='contained' onClick={handlevideocall}>Join</Button>

                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>
            </div>
        </>
    )
}


export default WithAuth(Homecomponent);