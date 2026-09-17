'use client';

import {useEffect,useRef,useState} from "react";

export default function Home(){
  const local=useRef<HTMLVideoElement>(null);
  const [room,setRoom]=useState("");
  const [joined,setJoined]=useState(false);
  const [muted,setMuted]=useState(false);
  const [camera,setCamera]=useState(true);
  const [status,setStatus]=useState("Create a room to begin");

  function createRoom(){
    const id=Math.random().toString(36).slice(2,9);
    setRoom(id);
    window.history.replaceState(null,"",`?room=${id}`);
    setJoined(true);
    setStatus("Room created. Share the link with the other person.");
  }
  async function startMedia(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      if(local.current){local.current.srcObject=stream; await local.current.play();}
      setStatus("Camera and microphone are ready.");
    }catch{setStatus("Please allow camera and microphone access in your browser.");}
  }
  function toggleMute(){
    const s=local.current?.srcObject as MediaStream|null;
    s?.getAudioTracks().forEach(t=>t.enabled=muted);
    setMuted(!muted);
  }
  function toggleCamera(){
    const s=local.current?.srcObject as MediaStream|null;
    s?.getVideoTracks().forEach(t=>t.enabled=!camera);
    setCamera(!camera);
  }
  function copyLink(){
    navigator.clipboard?.writeText(window.location.href);
    setStatus("Room link copied.");
  }
  useEffect(()=>{
    const r=new URLSearchParams(location.search).get("room");
    if(r){setRoom(r);setJoined(true);}
    return()=>{const s=local.current?.srcObject as MediaStream|null;s?.getTracks().forEach(t=>t.stop())};
  },[]);
  return <main className="page"><section className="card">
    <header><div><span className="eyebrow">BROWSER VIDEO CALL</span><h1>AI Video Call</h1><p>Private, consent-based calling between browsers.</p></div><span className={joined?"live":"off"}>{joined?"ROOM READY":"OFFLINE"}</span></header>
    <div className="videos">
      <div className="video"><video ref={local} muted playsInline/><span>You</span></div>
      <div className="video remote"><div className="waiting">Waiting for the other person…</div><span>Guest</span></div>
    </div>
    <div className="actions">
      {!joined?<button onClick={createRoom}>Create call room</button>:<button onClick={copyLink}>Copy invite link</button>}
      <button className="secondary" onClick={startMedia}>Start camera</button>
      <button className="secondary" onClick={toggleMute}>{muted?"Unmute":"Mute"}</button>
      <button className="secondary" onClick={toggleCamera}>{camera?"Camera off":"Camera on"}</button>
    </div>
    <div className="room">{joined?<><b>Room:</b> {room}</>:"No room created yet."}</div>
    <p className="status">{status}</p>
    <div className="notice"><b>Next step:</b> this interface is ready for a signaling server. A production deployment needs a small WebSocket signaling service (or a managed WebRTC provider) to connect the two browsers. Vercel serverless pages alone do not provide a persistent WebSocket room.</div>
  </section></main>
}