//const url = "wss://server.michielvaneerd.nl/api";
const url = "ws://localhost:3000";

let webSocket = null;

let isCalling = false;
const callButton = document.getElementById('call-button');
const pwdInput = document.getElementById('pwd-input');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

//let started = false;
let peerConnection = null;
let polite = false;
let makingOffer = false;
let ignoreOffer = false;
let stream = null;
let isSettingRemoteAnswerPending = false;

function reset() {
    peerConnection = null;
    polite = false;
    makingOffer = false;
    ignoreOffer = false;
    stream = null;
    isSettingRemoteAnswerPending = false;
}

// Called after clicking on the button
async function init(pwd) {

    callButton.innerText = 'Close';

    // 2) Create a RTCPeerConnection
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ],
    });

    console.log('new peerConnection created', peerConnection);
    window.myPeerConnection = peerConnection;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
    } catch (ex) {
        alert(ex);
        return;
    }

    //for (const track of stream.getTracks()) peerConnection.addTrack(track, stream);
    localVideo.srcObject = stream;

    // 3) Set up the events for the RTCPeerConnection
    peerConnection.ontrack = ({ track, streams }) => {
        track.onunmute = () => {
            if (remoteVideo.srcObject) {
                return;
            }
            remoteVideo.srcObject = streams[0];
        };
    };

    // Remote media shows up here once the connection is live.
    // peerConnection.ontrack = ({ streams: [stream] }) => {
    //     remoteVideo.srcObject = stream;
    // };

    // Trickle ICE: send each local candidate over the relay as we discover it.
    // Deze peer krijgt van het WebRCT een nieuwe iceCandidate en moet deze naar de andeer peer sturen.
    peerConnection.onicecandidate = ({ candidate }) => {
        //if (candidate) send({ type: "ice", candidate });
        send({ type: "ice", candidate });
    };

    // Whenever we need to (re)negotiate, make an offer. The "polite" peer backs off
    // if both sides offer at once, so this same handler is safe in both tabs.
    peerConnection.onnegotiationneeded = async () => {
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

    isCalling = true;
    webSocket = new WebSocket(url);
    webSocket.onopen = () => {
        send({ type: 'auth', pwd: pwd });
    };
    webSocket.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log(data.type);
        switch (data.type) {
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
        }
    };
    webSocket.onclose = () => {
        //close();
    };
}

const send = (msg) => webSocket.send(JSON.stringify(msg));

async function start() {
    console.log('In start!');
    // if (started) return;
    // started = true;
    // try {
    //     stream = await navigator.mediaDevices.getUserMedia({
    //         audio: true,
    //         video: true
    //     });
    // } catch (ex) {
    //     alert(ex);
    //     return;
    // }
    for (const track of stream.getTracks()) peerConnection.addTrack(track, stream);
    //localVideo.srcObject = stream;
}

function close() {
    if (peerConnection != null) {
        peerConnection.close();
        peerConnection = null;
        window.myPeerConnection = null;
    }
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