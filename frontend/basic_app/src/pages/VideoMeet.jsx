import React, { useEffect, useRef, useState } from 'react'
import { Badge, IconButton, Modal, TextField } from '@mui/material';
import io from "socket.io-client";
import { Button } from '@mui/material';
import styles from "../styles/VideoComponent.module.css";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import { useNavigate } from 'react-router-dom';

const server_url = import.meta.env.VITE_PROD_URL;
var connections = {};
const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeet() {
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([])
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    const videoRef = useRef([])
    let [videos, setVideos] = useState([])

    useEffect(() => { getPermissions(); }, [])

    const getPermissions = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(true);
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(true);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            window.localStream = userMediaStream;
            if (localVideoref.current) localVideoref.current.srcObject = userMediaStream;
        } catch (error) {
            console.log(error);
        }
    };

    let silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    }

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            stream.getTracks().forEach(track => {
                const sender = connections[id].getSenders().find(s => s.track?.kind === track.kind);
                if (sender) sender.replaceTrack(track);
                else connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then(description => {
                connections[id].setLocalDescription(description)
                    .then(() => socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })))
                    .catch(e => console.log(e));
            });
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                if (id === socketIdRef.current) continue;

                window.localStream.getTracks().forEach(track => {
                    const sender = connections[id].getSenders().find(s => s.track?.kind === track.kind);
                    if (sender) sender.replaceTrack(track);
                    else connections[id].addTrack(track, window.localStream);
                });

                connections[id].createOffer().then(description => {
                    connections[id].setLocalDescription(description)
                        .then(() => socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })))
                        .catch(e => console.log(e));
                });
            }
        });
    }

    let getDisplayMedia = () => {
        if (screen && navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                .then(getDisplayMediaSuccess)
                .catch((e) => console.log(e));
        }
    }

    let getDisplayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { console.log(e); }

        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            stream.getTracks().forEach(track => {
                const sender = connections[id].getSenders().find(s => s.track?.kind === track.kind);
                if (sender) sender.replaceTrack(track);
                else connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then(description => {
                connections[id].setLocalDescription(description)
                    .then(() => socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })))
                    .catch(e => console.log(e));
            });
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);
            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
            getUserMedia();
        });
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDisplayMedia();
        }
    }, [screen])

    let handleScreen = () => {
        setScreen(!screen);
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
    }

    let connect = () => {
        setAskForUsername(false);
        getMedia();
        connectToSocketServer();
    }

    let handleVideo = () => {
        setVideo(!video)
    }

    let handleAudio = () => {
        setAudio(!audio)
    }

    let sendMessage = () => {
        socketRef.current.emit('chat-message', message, username)
        setMessage("");
    }

    let routeTo = useNavigate();

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        routeTo("/home");
    }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', (fromId, message) => {
            let signal = JSON.parse(message);
            if (fromId !== socketIdRef.current) {
                if (!connections[fromId]) {
                    connections[fromId] = new RTCPeerConnection(peerConfigConnections);
                }
              connections[fromId].ontrack = (event) => {
    const stream = event.streams[0];
    const exists = videoRef.current.find(v => v.socketId === fromId);
    if (exists) {
        setVideos(prev => {
            const updated = prev.map(v =>
                v.socketId === fromId ? { ...v, stream } : v
            );
            videoRef.current = updated;
            return updated;
        });
    } else {
        const newVideo = {
            socketId: fromId,
            stream,
            autoplay: true,
            playsinline: true
        };
        setVideos(prev => {
            const updated = [...prev, newVideo];
            videoRef.current = updated;
            return updated;
        });
    }
};

                if (signal.sdp) {
                    connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                        if (signal.sdp.type === 'offer') {
                            connections[fromId].createAnswer().then(description => {
                                connections[fromId].setLocalDescription(description).then(() => {
                                    socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                                });
                            });
                        }
                    });
                }

                if (signal.ice) {
                    connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
                }
            }
        });

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;
        });

        socketRef.current.on('chat-message', (data, sender, socketIdSender) => {
            setMessages(prev => [...prev, { sender, data }]);
            if (socketIdSender !== socketIdRef.current) {
                setNewMessages(prev => prev + 1);
            }
        });

        socketRef.current.on('user-left', id => {
            setVideos(prev => prev.filter(video => video.socketId !== id));
        });
    }

   


  
  return (
    <div>
      {askForUsername===true?
      <div>
        <div className={styles.stratvideocompo}>
        <h2>Enter into loby</h2>
        <br />
        <TextField id="outlined-basic" label="Username" value={username} variant="outlined" onChange={e=>setUsername(e.target.value)}/>
            <br /><br />
        <Button variant="contained" onClick={connect}>Connect</Button>
        </div>

        <div className={styles.startvideo}>
          <video ref={localVideoref} autoPlay muted></video>
        </div>


      </div>:
      <div className={styles.meetcontainer}>
       {showModal? <div className={styles.chatroom}>
        <h2>Chats</h2>
            <div className={styles.chatcontainer}>
                <div className={styles.chattingdisplay}>
                     {messages.length !== 0 ? messages.map((item, index) => {

                                    console.log(messages)
                                    return (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No Messages Yet</p>}


                </div>
                <div className={styles.chatfooter}>
                 
                    <input type="text" placeholder='Enter your chat' value={message}  onChange={e=>setMessage(e.target.value)} style={{height:"2rem",width:"15rem",borderRadius:"5px"}}/>
                    <Button variant='contained' onClick={sendMessage}>Send</Button>
                </div>
                
            </div>
        </div>:<></>
        }


    
        <div className={styles.buttontab}>

            <IconButton onClick={handleVideo} style={{color:"white"}}>
                {(video===true)?<VideocamIcon/>:<VideocamOffIcon/>}
            </IconButton>
             <IconButton style={{color:"red"}} onClick={handleEndCall}>
                <CallEndIcon/>
            </IconButton>
              <IconButton onClick={handleAudio} style={{color:"white"}}>
                {(audio===true)?<MicIcon/>:<MicOffIcon/>}
            </IconButton>
            
                        {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon /> }
                            </IconButton> : <></>}
                            
                        <Badge badgeContent={newMessages}   max={999} color='secondary'>
                            <IconButton style={{ color: "white" }} onClick={()=>setModal(!showModal)}>
                                <ChatIcon />                        
                            </IconButton>
                        </Badge>

        </div>
          <video  className={styles.meetuser} ref={localVideoref} autoPlay muted></video>
                    <div className={styles.conferenceview} >
                        {videos.map((video) => (
                            <div key={video.socketId}>
                                <video
                                

                                    data-socket={video.socketId}
                                    ref={ref => {
                                        if (ref && video.stream) {
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    autoPlay
                                >
                                </video>
                            </div>

                        ))}
                        </div>
      </div>
 
     
        
        }
   
        

    </div>
  )
}  
