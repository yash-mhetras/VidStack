import React from "react";
import { useNavigate } from "react-router-dom";
import "../App.css"
export default function Landingpage(){
    const router = useNavigate();
    return(
        <div className="landingcontainer">
            <nav>
                <div className="navHeader">
                    <h2>VidStack</h2>
                </div>
                <div className="navList">
                    <p onClick={()=>router("/guest")}>Join as Guest</p>
                    <p  onClick={()=>router("/auth")}>Register</p>
                    <div role="button" onClick={()=>router("/auth")}>
                        <p>Login</p>

                    </div>

                </div>
            </nav>
            <div className="landingmaincontainer">
                <div >
                    <h1><span style={{color:"#FF9839"}}>Connect</span> with your Loved Ones</h1>
                     <p>Cover a distance by <span style={{color:"#FF9839",fontWeight:"bold"}}>VidStack</span></p>
                     <div role="button" onClick={()=>router("/auth")}>
                        <a >Get Started</a>
                     </div>
                </div>
                <div role="button">
                    <img src="/mobile.png" alt="" />
                </div>
            </div>
            
        </div>
    )
}
