const url = window.location.hostname === 'localhost'
    ? "ws://localhost:3000"
    : "wss://server.michielvaneerd.nl/api";

let webSocket = null;

let isCalling = false;
const callButton = document.getElementById('call-button');
const pwdInput = document.getElementById('pwd-input');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const statusLabel = document.getElementById('status-label');

//let started = false;
let peerConnection = null;
let polite = false;
let makingOffer = false;
let ignoreOffer = false;
let stream = null;
let isSettingRemoteAnswerPending = false;
let pingInterval = null;

function reset() {
    peerConnection = null;
    polite = false;
    makingOffer = false;
    ignoreOffer = false;
    stream = null;
    isSettingRemoteAnswerPending = false;
    window.myPeerConnection = null;
    callButton.innerText = 'Call';
    statusLabel.innerText = 'Closed';
    isCalling = false;
    ignoreOffer = false;
    webSocket = null;
    pingInterval = null;
}

function ping() {
    send({ type: 'ping' });
}

// Called after clicking on the button
async function init(pwd) {

    callButton.innerText = 'Close';
    statusLabel.innerText = 'Waiting for guest...';

    // navigator.mediaDevices.ondevicechange => kan ook nog als men later een webcam inplugt bijv.

    // Onze eigen media stream koppelen.
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
    } catch (ex) {
        alert(ex);
        console.error(ex);
        close();
        return;
    }
    localVideo.srcObject = stream;

    isCalling = true;
    webSocket = new WebSocket(url);

    webSocket.onopen = () => {
        console.log('Send password');
        // Hier kunnen we pas send()doen, dus ook hier pas de peerconnection opzetten!

        pingInterval = setInterval(ping, 5000);

        // PeerConnection opzetten
        // 2) Create a RTCPeerConnection
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ],
        });
        // Kan nu al...
        //for (const track of stream.getTracks()) peerConnection.addTrack(track, stream);

        console.log('new peerConnection created', peerConnection);
        window.myPeerConnection = peerConnection;

        // 3) Set up the events for the RTCPeerConnection
        // Dus we krijgen de media tracks van de remote peer en deze koppelen we aan de remoteVideo element, zoadt we de ander kunnen zien en horen.
        // peerConnection.ontrack = ({ track, streams }) => {
        //     track.onunmute = () => {
        //         if (remoteVideo.srcObject) {
        //             return;
        //         }
        //         remoteVideo.srcObject = streams[0];
        //     };
        // };

        // Remote media shows up here once the connection is live.
        // Dus we krijgen de media tracks van de remote peer en deze koppelen we aan de remoteVideo element, zoadt we de ander kunnen zien en horen.
        peerConnection.ontrack = ({ streams: [stream] }) => {
            console.log(`ontrack event`);
            remoteVideo.srcObject = stream;
        };

        // Trickle ICE: send each local candidate over the relay as we discover it.
        // Deze peer krijgt van het WebRCT een nieuwe iceCandidate en moet deze naar de andeer peer sturen.
        peerConnection.onicecandidate = ({ candidate }) => {
            //if (candidate) send({ type: "ice", candidate });
            console.log(`onicecandidate = ${candidate}`);
            send({ type: "ice", candidate });
        };

        peerConnection.onconnectionstatechange = (e) => {
            console.log(`connectionState = ${peerConnection.connectionState}`);
            statusLabel.innerText = peerConnection.connectionState;
        };

        peerConnection.onsignalingstatechange = (e) => {
            console.log(`signalingState = ${peerConnection.signalingState}`);
        };

        // Whenever we need to (re)negotiate, make an offer. The "polite" peer backs off
        // if both sides offer at once, so this same handler is safe in both tabs.
        peerConnection.onnegotiationneeded = async () => {
            console.log(`onnegotiationneeded`);
            try {
                makingOffer = true;
                // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation ==> inderdaad implicit offer/answer
                await peerConnection.setLocalDescription();                    // implicit createOffer()
                send({ type: "description", description: peerConnection.localDescription });
            } catch (err) {
                console.error(err);
            } finally {
                makingOffer = false;
            }
        };

        send({ type: 'auth', pwd: pwd });
    };
    webSocket.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log(`onmessage for ${data.type}`);
        switch (data.type) {
            case 'pong':
                break;
            case 'hangup':
                // Peer has hangup, so close all peer things.
                remoteVideo.srcObject = null;
                statusLabel.innerText = 'Guest has hangup';
                break;
            case 'unauth':
                alert('Wrong password!');
                break;
            case 'welcome':
                polite = data.polite;
                if (polite) {
                    // We are the second one, so we can start here.
                    start();
                }
                break;
            case 'ready':
                // We only get this if we are the impolite/first after the second has joined, so we can start here
                start();
                break;
            case 'ice':
                try {
                    await peerConnection.addIceCandidate(data.candidate);
                } catch (err) {
                    if (!ignoreOffer) throw err;                     // candidates for an ignored offer are expected to fail
                }
                break;
            case 'description':
                const description = data.description;
                const readyForOffer =
                    !makingOffer &&
                    (peerConnection.signalingState === "stable" || isSettingRemoteAnswerPending);
                const offerCollision = description.type === "offer" && !readyForOffer;
                ignoreOffer = !polite && offerCollision;
                if (ignoreOffer) {
                    return;
                }
                isSettingRemoteAnswerPending = description.type === "answer";
                await peerConnection.setRemoteDescription(description);
                isSettingRemoteAnswerPending = false;
                if (description.type === "offer") {
                    await peerConnection.setLocalDescription();
                    send({ type: "description", description: peerConnection.localDescription });
                }

                // const description = data.description;
                // const offerCollision =
                //     description.type === "offer" &&
                //     (makingOffer || peerConnection.signalingState !== "stable");
                // ignoreOffer = !polite && offerCollision;           // impolite peer ignores the colliding offer
                // if (ignoreOffer) return;
                // await peerConnection.setRemoteDescription(description);
                // if (description.type === "offer") {
                //     await peerConnection.setLocalDescription();                  // implicit createAnswer()
                //     send({ type: "description", description: peerConnection.localDescription });
                // }
                break;
            default:
                console.log(`Unknown message!`, data);
                break;
        }
    };
    webSocket.onclose = () => {
        close();
    };
}

const send = (msg) => webSocket.send(JSON.stringify(msg));

async function start() {
    console.log('start()');
    for (const track of stream.getTracks()) peerConnection.addTrack(track, stream);
}

function close() {
    if (peerConnection != null) {
        peerConnection.close();
    }
    if (webSocket !== null) {
        webSocket.close();
    }
    for (const video of [localVideo, remoteVideo]) {
        const stream = video.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach((track) => {
                track.stop();
            });
        }
        video.srcObject = null;
    }
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    reset();
}

callButton.addEventListener('click', function (e) {
    if (isCalling) {
        send({ type: 'hangup' });
        close();
    } else {
        init(pwdInput.value);
    }
});