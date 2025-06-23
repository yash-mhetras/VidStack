// Fixed VideoMeet.js
import React, { useEffect, useRef, useState } from 'react'
import { Badge, IconButton, TextField, Button } from '@mui/material';
import io from "socket.io-client";
import styles from "../styles/VideoComponent.module.css";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
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
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [screen, setScreen] = useState(false);
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setVideoAvailable(true);
            setAudioAvailable(true);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            window.localStream = stream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }
        } catch (error) {
            console.log("Permission error:", error);
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
                    if (socketListId === socketIdRef.current || connections[socketListId]) return;
                    const peer = new RTCPeerConnection(peerConfigConnections);
                    connections[socketListId] = peer;

                    peer.onicecandidate = (event) => {
                        if (event.candidate) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
                        }
                    };

                    peer.ontrack = (event) => {
                        const incomingStream = event.streams[0];
                        setVideos(prev => {
                            const exists = prev.find(v => v.socketId === socketListId);
                            if (exists) return prev.map(v => v.socketId === socketListId ? { ...v, stream: incomingStream } : v);
                            const updated = [...prev, { socketId: socketListId, stream: incomingStream }];
                            videoRef.current = updated;
                            return updated;
                        });
                    };

                    if (window.localStream) {
                        window.localStream.getTracks().forEach(track => {
                            peer.addTrack(track, window.localStream);
                        });
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

    const gotMessageFromServer = (fromId, message) => {
        const signal = JSON.parse(message);
        if (fromId !== socketIdRef.current) {
            const peer = connections[fromId];
            if (signal.sdp) {
                peer.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        peer.createAnswer().then((desc) => {
                            peer.setLocalDescription(desc).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: peer.localDescription }));
                            });
                        });
                    }
                });
            }
            if (signal.ice) {
                peer.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages(prev => [...prev, { sender, data }]);
        if (socketIdSender !== socketIdRef.current) setNewMessages(prev => prev + 1);
    };

    const connect = async () => {
        setAskForUsername(false);
        await getPermissions();
        if (window.localStream) {
            connectToSocketServer();
        }
    };

    const handleVideo = () => setVideo(!video);
    const handleAudio = () => setAudio(!audio);
    const handleScreen = () => setScreen(!screen);
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
            {askForUsername ? (
                <div>
                    <div className={styles.stratvideocompo}>
                        <h2>Enter into lobby</h2>
                        <TextField label="Username" value={username} onChange={e => setUsername(e.target.value)} />
                        <Button variant="contained" onClick={connect}>Connect</Button>
                    </div>
                    <div className={styles.startvideo}>
                        <video ref={localVideoref} autoPlay muted></video>
                    </div>
                </div>
            ) : (
                <div className={styles.meetcontainer}>
                    {showModal && (
                        <div className={styles.chatroom}>
                            <h2>Chats</h2>
                            <div className={styles.chatcontainer}>
                                <div className={styles.chattingdisplay}>
                                    {messages.length ? messages.map((item, index) => (
                                        <div key={index} style={{ marginBottom: "20px" }}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )) : <p>No Messages Yet</p>}
                                </div>
                                <div className={styles.chatfooter}>
                                    <input type="text" value={message} onChange={e => setMessage(e.target.value)} />
                                    <Button variant='contained' onClick={sendMessage}>Send</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.buttontab}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton style={{ color: "red" }} onClick={handleEndCall}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                        {screenAvailable && (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                        )}
                        <Badge badgeContent={newMessages} color='secondary'>
                            <IconButton style={{ color: "white" }} onClick={() => setModal(!showModal)}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>

                    <video className={styles.meetuser} ref={localVideoref} autoPlay muted></video>
                    <div className={styles.conferenceview}>
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
                                ></video>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
