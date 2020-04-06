const stunServerUrlElem = document.getElementById('stun-server-url');
const turnServerUrlElem = document.getElementById('turn-server-url');
const turnServerUserElem = document.getElementById('turn-server-user');
const turnServerPassElem = document.getElementById('turn-server-pass');
const forceUseForTurnElem = document.getElementById('force-use-for-turn');

const localVideoElem = document.getElementById('local-video');
const remoteVideoElem = document.getElementById('remote-video');

const logConsole = document.getElementById('log-console');

const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');
const offerSdpElem = document.getElementById('offer-sdp');
const answerSdpElem = document.getElementById('answer-sdp');
const createOfferButton = document.getElementById('create-offer-button');
const receiveAnswerButton = document.getElementById('receive-answer-button');

const getLocalSDPButton = document.getElementById('get-local-sdp');
const getRemoteSDPButton = document.getElementById('get-remote-sdp');

let pc = null;
let ws = null;
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
const createPeerConnection = (localStream, iceServers) => {
    logger(`createPeerConnection`);

    const _pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: useTurn ? 'relay' : 'all'
    });

    localStorage.setItem('stunServerUrl', stunServerUrlElem.value);
    localStorage.setItem('turnServerUrl', turnServerUrlElem.value);
    localStorage.setItem('turnServerUser', turnServerUserElem.value);
    localStorage.setItem('turnServerPass', turnServerPassElem.value);
    localStorage.setItem('forceUseForTurn', forceUseForTurnElem.checked);
    _pc.onconnectionstatechange = evt => {
        logger(`onconnectionstatechange->${_pc.connectionState}`);
        if (_pc.connectionState === 'connected') {
            isConnected = true;
        }
    };
    _pc.onicecandidate = evt => {
        logger(`onicecandidate`);
        if (evt.candidate) {
            offerSdpElem.value = _pc.localDescription.sdp;
            offerSdpElem.focus();
            offerSdpElem.select();
            ws.send(JSON.stringify({ type: 'candidate', ice: evt.candidate }));
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
        remoteVideoElem.srcObject = evt.streams[0];
    };
    _pc.addStream(localStream);

    return _pc;
};
const onCreateOffer = (localStream, iceServers) => {
    logger('onCreateOffer');
    pc = createPeerConnection(localStream, iceServers);

    pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: true
    })
        .then(offerSdp => {
            logger(`createOffer`);
            return pc.setLocalDescription(offerSdp);
        }).then(() => {
            ws.send(JSON.stringify(pc.localDescription));
        })
        .catch(err => {
            logger(`createOffer->${err.message}`, 'error');
        });
};
const onReceiveAnswer = receiveSdp => {
    logger(`onReceiveAnswer`);
    // const receiveSdp = answerSdpElem.value;
    pc.setRemoteDescription(
        new RTCSessionDescription({
            type: 'answer',
            sdp: receiveSdp
        })
    )
        .then(() => {
            logger(`setAnswerSDP`);
        })
        .catch(err => {
            logger(`setAnswerSDP->${err.message}`, 'error');
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
    let localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideoElem.srcObject = localStream;
    logger('set stream');

    let iceServers = null;
    connectButton.addEventListener('click', () => {
        onCreateOffer(localStream, iceServers);
    });
    disconnectButton.addEventListener('click', () => {
        pc.close();
        pc = null;
        ws.close();
        localVideoElem.pause();
        localVideoElem.srcObject = null;
        localStream = nuill;
    });
    // createOfferButton.addEventListener('click', () => {
    //     // onCreateOffer(localStream);
    // });
    // receiveAnswerButton.addEventListener('click', onReceiveAnswer);

    getLocalSDPButton.addEventListener('click', () => {
        console.log(pc.localDescription);
    });
    getRemoteSDPButton.addEventListener('click', () => {
        console.log(pc.remoteDescription);
    });

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
                    console.log('accepted');
                    iceServers = recvData.iceServers;
                } else if (recvData.type === 'answer') {
                    if (!isConnected) {
                        answerSdpElem.value = recvData.sdp;
                        onReceiveAnswer(recvData.sdp);
                    }
                } else if (recvData.type === 'candidate') {
                    onReceiveCandidate(recvData.ice);
                }
            };
        }
    }
})();
