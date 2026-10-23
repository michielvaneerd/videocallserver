// Note: on localhost you can use ws:// but otherwise you must use wss://

//const url = "wss://server.michielvaneerd.nl/api";
const url = "ws://localhost:3000";

let webSocket = null;
// //const ws = new WebSocket("wss://server.michielvaneerd.nl/api");

// ws.onopen = () => {
//     console.log("Connected");
//     //ws.send("Hello from the browser");
// };

// ws.onmessage = (event) => {
//     console.log("Server says:", event.data);
// };

// ws.onclose = () => {
//     console.log("Disconnected");
// };

let isCalling = false;
const localCallButton = document.getElementById('localCallButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let started = false;

let polite = false;       // set from the server's "welcome"
let makingOffer = false;
let ignoreOffer = false;

async function init() {
    const constraints = window.constraints = {
        audio: false,
        video: true
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // const videoTracks = stream.getVideoTracks();
    // console.log('Got stream with constraints:', constraints);
    // console.log(`Using video device: ${videoTracks[0].label}`);
    localVideo.srcObject = stream;
    localCallButton.innerText = 'Close';

    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

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
    webSocket.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        switch (data.type) {
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
        //console.log(data);
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
    webSocket.close();
    const stream = localVideo.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
        track.stop();
    });
    localVideo.srcObject = null;
    localCallButton.innerText = 'Call';
    isCalling = false;
}

localCallButton.addEventListener('click', function (e) {
    if (isCalling) {
        close();
    } else {
        init();
    }
});