import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Real (not mocked) mic voice chat for up to 4 people in a battle room,
 * using WebRTC with Supabase Realtime as the signaling transport (no
 * separate voice server needed).
 *
 * ⚠️ Honest limitation: this uses public Google STUN servers only, no TURN
 * relay. That means it works for most home/mobile networks but can fail to
 * connect between two people who are BOTH behind restrictive/corporate
 * NATs (no direct path and nothing to relay through). A TURN server (e.g.
 * Twilio, Cloudflare Calls, or your own coturn) would close that gap but
 * needs its own account/credentials — this is a genuine trade-off, not a
 * bug, and worth knowing about before assuming voice "always" works for
 * every player.
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type SignalPayload =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export function useRoomVoice(roomId: string | null, userId: string | null) {
  const [micOn, setMicOn] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const audioElsRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`battle-voice-${roomId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    const ensurePeer = (peerId: string): RTCPeerConnection => {
      let pc = peersRef.current[peerId];
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peersRef.current[peerId] = pc;

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) pc.addTrack(track, localStreamRef.current);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({ type: "broadcast", event: "signal", payload: { kind: "ice", from: userId, to: peerId, candidate: e.candidate.toJSON() } satisfies SignalPayload });
        }
      };

      pc.ontrack = (e) => {
        let audio = audioElsRef.current[peerId];
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioElsRef.current[peerId] = audio;
        }
        audio.srcObject = e.streams[0];
        setConnectedPeers((p) => (p.includes(peerId) ? p : [...p, peerId]));
      };

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === "disconnected" || pc!.connectionState === "failed" || pc!.connectionState === "closed") {
          setConnectedPeers((p) => p.filter((id) => id !== peerId));
        }
      };

      return pc;
    };

    channel.on("broadcast", { event: "signal" }, async ({ payload }: { payload: SignalPayload }) => {
      if (payload.to !== userId) return;
      const pc = ensurePeer(payload.from);
      if (payload.kind === "offer") {
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: "broadcast", event: "signal", payload: { kind: "answer", from: userId, to: payload.from, sdp: answer } satisfies SignalPayload });
      } else if (payload.kind === "answer") {
        await pc.setRemoteDescription(payload.sdp);
      } else if (payload.kind === "ice") {
        try { await pc.addIceCandidate(payload.candidate); } catch { /* candidate arrived before remote description — safe to drop */ }
      }
    });

    // A new peer announces itself; everyone already in the room initiates
    // an offer to them (simple "newcomer is always the answerer" mesh
    // convention — avoids the glare problem of both sides offering at once).
    channel.on("broadcast", { event: "peer-joined" }, async ({ payload }: { payload: { userId: string } }) => {
      if (payload.userId === userId) return;
      const pc = ensurePeer(payload.userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({ type: "broadcast", event: "signal", payload: { kind: "offer", from: userId, to: payload.userId, sdp: offer } satisfies SignalPayload });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") channel.send({ type: "broadcast", event: "peer-joined", payload: { userId } });
    });

    return () => {
      for (const pc of Object.values(peersRef.current)) pc.close();
      peersRef.current = {};
      for (const audio of Object.values(audioElsRef.current)) { audio.pause(); audio.srcObject = null; }
      audioElsRef.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnectedPeers([]);
      setMicOn(false);
    };
  }, [roomId, userId]);

  const toggleMic = async () => {
    if (micOn) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      for (const pc of Object.values(peersRef.current)) {
        for (const sender of pc.getSenders()) if (sender.track) pc.removeTrack(sender);
      }
      setMicOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      for (const pc of Object.values(peersRef.current)) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }
      setMicOn(true);
    } catch {
      // Mic permission denied or unavailable — fail soft, text chat still works.
      setMicOn(false);
    }
  };

  return { micOn, toggleMic, connectedPeers, speaking };
}
