const stunServerUrlElem = document.getElementById('stun-server-url');
const turnServerUrlElem = document.getElementById('turn-server-url');
const turnServerUserElem = document.getElementById('turn-server-user');
const turnServerPassElem = document.getElementById('turn-server-pass');
const forceUseForTurnElem = document.getElementById('force-use-for-turn');

const localVideoElem = document.getElementById('local-video');
const remoteVideoElem = document.getElementById('remote-video');

const logConsole = document.getElementById('log-console');

const offerSdpElem = document.getElementById('offer-sdp');
const answerSdpElem = document.getElementById('answer-sdp');
const createOfferButton = document.getElementById('create-offer-button');
const receiveAnswerButton = document.getElementById('receive-answer-button');

const getLocalSDPButton = document.getElementById('get-local-sdp');
const getRemoteSDPButton = document.getElementById('get-remote-sdp');

let pc = null;

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
const createPeerConnection = localStream => {
    logger(`createPeerConnection`);
    const turnServerConfig = {
        urls: turnServerUrlElem.value,
        username: turnServerUserElem.value,
        credential: turnServerPassElem.value
    };
    const iceServers = [
        { urls: (stunServerUrlElem.value === '') ? 'stun:stun.l.google.com:19302' : stunServerUrlElem.value }
    ]
    if (turnServerConfig.urls !== '' && turnServerConfig.username !== '' && turnServerConfig.credential !== '') {
        iceServers.push(turnServerConfig);
    }

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
        if (!evt.candidate) {
            offerSdpElem.value = _pc.localDescription.sdp;
            offerSdpElem.focus();
            offerSdpElem.select();
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
const onCreateOffer = localStream => {
    logger('onCreateOffer');
    pc = createPeerConnection(localStream);

    pc.createOffer()
        .then(offerSdp => {
            logger(`createOffer`);
            return pc.setLocalDescription(offerSdp);
        })
        .catch(err => {
            logger(`createOffer->${err.message}`, 'error');
        });
};
const onReceiveAnswer = () => {
    logger(`onReceiveAnswer`);
    const receiveSdp = answerSdpElem.value;
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

    createOfferButton.addEventListener('click', () => {
        onCreateOffer(localStream);
    });
    receiveAnswerButton.addEventListener('click', onReceiveAnswer);

    getLocalSDPButton.addEventListener('click', () => {
        console.log(pc.localDescription);
    });
    getRemoteSDPButton.addEventListener('click', () => {
        console.log(pc.remoteDescription);
    });

    const signalingUrl = '';
    const roomId = '';
    const options = {
        video: {
            direction: 'sendrecv', enable: true,
            clientId: 'clientId'
        }
    };
})();
