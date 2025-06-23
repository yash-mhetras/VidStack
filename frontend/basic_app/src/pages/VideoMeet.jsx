import React, { useEffect, useRef, useState } from 'react'
import { Badge, IconButton, TextField } from '@mui/material';
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
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

export default function VideoMeet() {
    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoref = useRef();
    const videoRef = useRef([]);

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState([]);
    const [audio, setAudio] = useState();
    const [screen, setScreen] = useState();
    const [showModal, setModal] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [videos, setVideos] = useState([]);

    const routeTo = useNavigate();

    useEffect(() => {
        getPermissions();
    }, []);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(!!videoPermission);

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(!!audioPermission);

            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    const getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { console.log(e); }

        window.localStream = stream;
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream;
        }

        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            stream.getTracks().forEach(track => {
                connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                    })
                    .catch(e => console.log(e));
            });
        }
    };

    const silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    const black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };

    const getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e));
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            } catch (e) { }
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
        }
    }, [video, audio]);

    const gotMessageFromServer = (fromId, message) => {
        const signal = JSON.parse(message);

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                            });
                        });
                    }
                });
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages(prev => [...prev, { sender, data }]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages(prev => prev + 1);
        }
    };

    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on('chat-message', addMessage);
            socketRef.current.on('user-left', (id) => {
                setVideos(prev => prev.filter(video => video.socketId !== id));
            });

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    const peer = new RTCPeerConnection(peerConfigConnections);
                    connections[socketListId] = peer;

                    peer.onicecandidate = (event) => {
                        if (event.candidate) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
                        }
                    };

                    peer.ontrack = (event) => {
                        const incomingStream = event.streams[0];
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            setVideos(prev => {
                                const updated = prev.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: incomingStream } : video
                                );
                                videoRef.current = updated;
                                return updated;
                            });
                        } else {
                            const newVideo = {
                                socketId: socketListId,
                                stream: incomingStream,
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

                    if (window.localStream) {
                        window.localStream.getTracks().forEach(track => {
                            peer.addTrack(track, window.localStream);
                        });
                    } else {
                        const fallbackStream = new MediaStream([black(), silence()]);
                        window.localStream = fallbackStream;
                        fallbackStream.getTracks().forEach(track => peer.addTrack(track, fallbackStream));
                    }
                });

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue;
                        const peer = connections[id2];

                        window.localStream.getTracks().forEach(track => {
                            peer.addTrack(track, window.localStream);
                        });

                        peer.createOffer().then(description => {
                            peer.setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', id2, JSON.stringify({ sdp: peer.localDescription }));
                            });
                        });
                    }
                }
            });
        });
    };

    const getDislayMedia = () => {
        if (screen && navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                .then(getDislayMediaSuccess)
                .catch(e => console.log(e));
        }
    };

    const getDislayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { console.log(e); }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            stream.getTracks().forEach(track => {
                connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then(description => {
                connections[id].setLocalDescription(description).then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                });
            });
        }

        stream.getTracks().forEach(track => {
            track.onended = () => {
                setScreen(false);
                try {
                    let tracks = localVideoref.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                } catch (e) { console.log(e); }

                const fallbackStream = new MediaStream([black(), silence()]);
                window.localStream = fallbackStream;
                localVideoref.current.srcObject = fallbackStream;

                getUserMedia();
            }
        });
    };

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen]);

    const handleScreen = () => setScreen(!screen);
    const handleVideo = () => setVideo(!video);
    const handleAudio = () => setAudio(!audio);

    const getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        getUserMedia();
    };

    const connect = async () => {
        setAskForUsername(false);
        await getMedia();
        connectToSocketServer();
    };

    const sendMessage = () => {
        socketRef.current.emit('chat-message', message, username);
        setMessage("");
    };

    const handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        } catch (e) { }
        routeTo("/home");
    };

  
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