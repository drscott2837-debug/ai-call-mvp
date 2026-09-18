'use client';

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:3001";

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function Home() {
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);

  const socket = useRef<Socket | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Create a room to begin");

  async function startMedia() {
    try {
      if (localStream.current) return localStream.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.current = stream;

      if (local.current) {
        local.current.srcObject = stream;
        await local.current.play();
      }

      setStatus("Camera and microphone are ready.");
      return stream;
    } catch (error) {
      console.error(error);
      setStatus("Please allow camera and microphone access.");
      return null;
    }
  }

  function createPeer() {
    if (peer.current) return peer.current;

    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", {
          roomId: room,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];

      if (remote.current && stream) {
        remote.current.srcObject = stream;
        remote.current.play().catch(() => {});
      }

      setConnected(true);
      setStatus("Connected to the other person.");
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        setConnected(false);
        setStatus("The other person disconnected.");
      }
    };

    peer.current = pc;
    return pc;
  }

  async function addLocalTracks(pc: RTCPeerConnection) {
    const stream = await startMedia();

    if (!stream) return;

    const existingTracks = new Set(
      pc.getSenders()
        .map((sender) => sender.track?.id)
        .filter(Boolean)
    );

    stream.getTracks().forEach((track) => {
      if (!existingTracks.has(track.id)) {
        pc.addTrack(track, stream);
      }
    });
  }

  async function makeOffer() {
    const pc = createPeer();

    await addLocalTracks(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.current?.emit("offer", {
      roomId: room,
      offer,
    });

    setStatus("Calling the other person...");
  }

  async function handleOffer(offer: RTCSessionDescriptionInit) {
    const pc = createPeer();

    await addLocalTracks(pc);

    await pc.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    for (const candidate of pendingCandidates.current) {
      await pc.addIceCandidate(candidate);
    }

    pendingCandidates.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.current?.emit("answer", {
      roomId: room,
      answer,
    });

    setStatus("Joining the call...");
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    const pc = peer.current;

    if (!pc) return;

    await pc.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

    for (const candidate of pendingCandidates.current) {
      await pc.addIceCandidate(candidate);
    }

    pendingCandidates.current = [];

    setStatus("Connecting...");
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    const pc = peer.current;

    if (!pc) return;

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error(error);
      }
    } else {
      pendingCandidates.current.push(candidate);
    }
  }

  function createRoom() {
    const id = Math.random().toString(36).slice(2, 9);

    setRoom(id);
    window.history.replaceState(null, "", `?room=${id}`);
    setJoined(true);
    setStatus("Room created. Starting camera...");
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href);
    setStatus("Room link copied.");
  }

  function toggleMute() {
    const stream = localStream.current;

    if (!stream) {
      setStatus("Start the camera first.");
      return;
    }

    const newMuted = !muted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });

    setMuted(newMuted);
  }

  function toggleCamera() {
    const stream = localStream.current;

    if (!stream) {
      setStatus("Start the camera first.");
      return;
    }

    const newCamera = !camera;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = newCamera;
    });

    setCamera(newCamera);
  }

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(
      window.location.search
    ).get("room");

    if (roomFromUrl) {
      setRoom(roomFromUrl);
      setJoined(true);
      setStatus("Joining room...");
    }
  }, []);

  useEffect(() => {
    if (!joined || !room) return;

    const newSocket = io(SIGNALING_SERVER);

    socket.current = newSocket;

    newSocket.on("connect", () => {
      setStatus("Connected to signaling server.");
      newSocket.emit("join-room", room);
    });

    newSocket.on("connect_error", () => {
      setStatus(
        "Signaling server is not available yet."
      );
    });

    newSocket.on("room-joined", async ({ userCount }) => {
      if (userCount === 1) {
        await startMedia();
        setStatus("Waiting for the other person...");
      }
    });

    newSocket.on("user-joined", async () => {
      setStatus("The other person joined.");
      await makeOffer();
    });

    newSocket.on("offer", async (offer) => {
      await handleOffer(offer);
    });

    newSocket.on("answer", async (answer) => {
      await handleAnswer(answer);
    });

    newSocket.on("ice-candidate", async (candidate) => {
      await handleIceCandidate(candidate);
    });

    return () => {
      newSocket.disconnect();

      if (peer.current) {
        peer.current.close();
        peer.current = null;
      }

      socket.current = null;
    };
  }, [joined, room]);

  useEffect(() => {
    return () => {
      localStream.current
        ?.getTracks()
        .forEach((track) => track.stop());

      peer.current?.close();
      socket.current?.disconnect();
    };
  }, []);

  return (
    <main className="page">
      <section className="card">
        <header>
          <div>
            <span className="eyebrow">
              BROWSER VIDEO CALL
            </span>

            <h1>AI Video Call</h1>

            <p>
              Private, consent-based calling between browsers.
            </p>
          </div>

          <span
            className={
              connected
                ? "live"
                : joined
                ? "live"
                : "off"
            }
          >
            {connected
              ? "CONNECTED"
              : joined
              ? "ROOM READY"
              : "OFFLINE"}
          </span>
        </header>

        <div className="videos">
          <div className="video">
            <video
              ref={local}
              muted
              playsInline
              autoPlay
            />
            <span>You</span>
          </div>

          <div className="video remote">
            <video
              ref={remote}
              playsInline
              autoPlay
            />

            {!connected && (
              <div className="waiting">
                Waiting for the other person…
              </div>
            )}

            <span>Guest</span>
          </div>
        </div>

        <div className="actions">
          {!joined ? (
            <button onClick={createRoom}>
              Create call room
            </button>
          ) : (
            <button onClick={copyLink}>
              Copy invite link
            </button>
          )}

          <button
            className="secondary"
            onClick={startMedia}
          >
            Start camera
          </button>

          <button
            className="secondary"
            onClick={toggleMute}
          >
            {muted ? "Unmute" : "Mute"}
          </button>

          <button
            className="secondary"
            onClick={toggleCamera}
          >
            {camera ? "Camera off" : "Camera on"}
          </button>
        </div>

        <div className="room">
          {joined ? (
            <>
              <b>Room:</b> {room}
            </>
          ) : (
            "No room created yet."
          )}
        </div>

        <p className="status">{status}</p>

        <div className="notice">
          <b>WebRTC:</b> Your browser connects directly
          to the other browser for video and audio.
        </div>
      </section>
    </main>
  );
}
