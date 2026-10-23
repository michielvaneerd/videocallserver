//const url = "wss://server.michielvaneerd.nl/api";
const url = "ws://localhost:3000";

let webSocket = null;

let isCalling = false;
const callButton = document.getElementById('call-button');
const pwdInput = document.getElementById('pwd-input');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let started = false;
let pc = null;
let polite = false;       // set from the server's "welcome"
let makingOffer = false;
let ignoreOffer = false;

async function init(pwd) {

    // 1) Add the local stream to the local video, so we can see ourselves.
    const constraints = window.constraints = {
        audio: true,
        video: true
    };
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (ex) {
        alert(ex);
        return;
    }

    localVideo.srcObject = stream;
    callButton.innerText = 'Close';

    // 2) Create a RTCPeerConnection
    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ],
    });

    // 3) Set up the events for the RTCPeerConnection

    // Remote media shows up here once the connection is live.
    pc.ontrack = ({ streams: [stream] }) => {
        remoteVideo.srcObject = stream;
    };

    // Trickle ICE: send each local candidate over the relay as we discover it.
    pc.onicecandidate = ({ candidate }) => {
        if (candidate) send({ type: "ice", candidate });
    };

    // Whenever we need to (re)negotiate, make an offer. The "polite" peer backs off
    // if both sides offer at once, so this same handler is safe in both tabs.
    pc.onnegotiationneeded = async () => {
        try {
            makingOffer = true;
            await pc.setLocalDescription();                    // implicit createOffer()
            send({ type: "description", description: pc.localDescription });
        } finally {
            makingOffer = false;
        }
    };

    isCalling = true;
    webSocket = new WebSocket(url);
    webSocket.onopen = () => {
        send({ type: 'auth', pwd: pwd });
    };
    webSocket.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        switch (data.type) {
            case 'unauth':
                alert('Wrong password!');
                break;
            case 'welcome':
                polite = data.polite;
                if (polite) {
                    // We are the second one, so we can start here.
                    start(pc, stream);
                }
                break;
            case 'ready':
                // We only get this if we are the impolite/first after the second has joined, so we can start here
                start(pc, stream);
                break;
            case 'ice':
                try {
                    await pc.addIceCandidate(data.candidate);
                } catch (err) {
                    if (!ignoreOffer) throw err;                     // candidates for an ignored offer are expected to fail
                }
                break;
            case 'description':
                const description = data.description;
                const offerCollision =
                    description.type === "offer" &&
                    (makingOffer || pc.signalingState !== "stable");
                ignoreOffer = !polite && offerCollision;           // impolite peer ignores the colliding offer
                if (ignoreOffer) return;
                await pc.setRemoteDescription(description);
                if (description.type === "offer") {
                    await pc.setLocalDescription();                  // implicit createAnswer()
                    send({ type: "description", description: pc.localDescription });
                }
                break;
        }
    };
    webSocket.onclose = () => {
        //close();
    };
}

const send = (msg) => webSocket.send(JSON.stringify(msg));

function start(pc, stream) {
    if (started) return;
    started = true;
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
}

function close() {
    started = false;
    pc.close();
    webSocket.close();
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
    callButton.innerText = 'Call';
    isCalling = false;
    ignoreOffer = false;
}

callButton.addEventListener('click', function (e) {
    if (isCalling) {
        close();
    } else {
        init(pwdInput.value);
    }
});