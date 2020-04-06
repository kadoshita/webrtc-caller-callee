const stunServerUrlElem = document.getElementById('stun-server-url');
const turnServerUrlElem = document.getElementById('turn-server-url');
const turnServerUserElem = document.getElementById('turn-server-user');
const turnServerPassElem = document.getElementById('turn-server-pass');
const forceUseForTurnElem = document.getElementById('force-use-for-turn');

const remoteVideoElem = document.getElementById('remote-video');

const logConsole = document.getElementById('log-console');

const offerSdpElem = document.getElementById('offer-sdp');
const answerSdpElem = document.getElementById('answer-sdp');
const receiveOfferButton = document.getElementById('receive-offer-button');

let ws = null;
let pc = null;
let remoteStream = null;
let iceServers = null;
let isConnected = false;

const zero_padding = (num, digit) => {
    return num.toString().padStart(digit, '0');
};
const logger = (log, type = 'log') => {
    switch (type) {
        case 'error':
            console.error(log);
            break;
        case 'info':
            console.info(log);
            break;
        case 'debug':
            console.debug(log);
            break;
        default:
            console.log(log);
            break;
    }
    const date = new Date();
    const prevValue = logConsole.value;
    logConsole.value = `[${type.toUpperCase()}] ${date.toLocaleTimeString()}.${zero_padding(date.getMilliseconds(), 3)}: ${log}\n` + prevValue;
};
const createPeerConnection = () => {
    logger(`createPeerConnection`);

    const _pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: forceUseForTurnElem.checked ? 'relay' : 'all'
    });

    localStorage.setItem('stunServerUrl', stunServerUrlElem.value);
    localStorage.setItem('turnServerUrl', turnServerUrlElem.value);
    localStorage.setItem('turnServerUser', turnServerUserElem.value);
    localStorage.setItem('turnServerPass', turnServerPassElem.value);
    localStorage.setItem('forceUseForTurn', forceUseForTurnElem.checked);

    _pc.onconnectionstatechange = evt => {
        logger(`onconnectionstatechange->${_pc.connectionState}`);
    };
    _pc.onicecandidate = evt => {
        logger(`onicecandidate`);
        if (evt.candidate) {
            answerSdpElem.value = _pc.localDescription.sdp;
            answerSdpElem.focus();
            answerSdpElem.select();
            ws.send(JSON.stringify(pc.localDescription));
        }
    };
    _pc.oniceconnectionstatechange = evt => {
        logger(`oniceconnectionstatechange->${_pc.iceConnectionState}`);
    };
    _pc.onicegatheringstatechange = () => {
        logger(`onicegatheringstatechange->${_pc.iceGatheringState}`);
    };
    _pc.onnegotiationneeded = () => {
        logger(`onnegotiationneeded`);
    };
    _pc.onsignalingstatechange = evt => {
        logger(`onsignalingstatechange->${_pc.signalingState}`);
    };
    _pc.ontrack = evt => {
        logger(`ontrack`);
        remoteStream = evt.streams[0];
        remoteVideoElem.srcObject = evt.streams[0];
        _pc.addStream(remoteStream);
    };

    return _pc;
};
const onReceiveOffer = () => {
    logger(`onReceiveOffer`);
    pc = createPeerConnection();
    const offerSdp = offerSdpElem.value;
    pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }))
        .then(() => {
            logger(`set Offer SDP`);
            if (pc.remoteDescription.type === 'offer') {
                pc.createAnswer()
                    .then(answerSdp => {
                        logger(`createAnswer`);
                        return pc.setLocalDescription(answerSdp);
                    })
                    .catch(err => {
                        logger(`createAnswer->${err.message}`, 'error');
                    });
            }
        })
        .catch(err => {
            logger(`set Offer SDP->${err.message}`, 'error');
        });
};
const onReceiveCandidate = sdp => {
    const candidate = new RTCIceCandidate(sdp);
    pc.addIceCandidate(candidate);
};

(async () => {
    logger('start');
    stunServerUrlElem.value = localStorage.getItem('stunServerUrl');
    turnServerUrlElem.value = localStorage.getItem('turnServerUrl');
    turnServerUserElem.value = localStorage.getItem('turnServerUser');
    turnServerPassElem.value = localStorage.getItem('turnServerPass');
    forceUseForTurnElem.checked = (localStorage.getItem('forceUseForTurn') === 'true');
    // receiveOfferButton.addEventListener('click', () => {
    //     onReceiveOffer();
    // });

    const options = {
        video: {
            direction: 'sendrecv', enable: true
        },
        clientId: 'clientId'
    };
    ws = new WebSocket(signalingUrl);
    ws.onclose = () => {
        console.log('close');
    };
    ws.onerror = () => {
        console.error('ws error');
    };

    ws.onopen = () => {
        console.log('open');
        const registerMessage = {
            type: 'register',
            roomId: roomId,
            clientId: options.clientId,
            authnMetadata: undefined,
            key: signalingKey
        };
        ws.send(JSON.stringify(registerMessage));
        if (ws) {
            ws.onmessage = async evt => {
                const recvData = JSON.parse(evt.data);
                console.log(recvData);
                if (recvData.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                } else if (recvData.type === 'accept') {
                    iceServers = recvData.iceServers;
                } else if (recvData.type === 'offer') {
                    offerSdpElem.value = recvData.sdp;
                    onReceiveOffer();
                } else if (recvData.type === 'candidate') {
                    onReceiveCandidate(recvData.ice);
                }
            };
        }
    }
})();
