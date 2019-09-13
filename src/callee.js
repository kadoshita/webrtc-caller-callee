const localVideoElem = document.getElementById('local-video');
const remoteVideoElem = document.getElementById('remote-video');

const logConsole = document.getElementById('log-console');

const offerSdpElem = document.getElementById('offer-sdp');
const answerSdpElem = document.getElementById('answer-sdp');
const receiveOfferButton = document.getElementById('receive-offer-button');

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
    const _pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    _pc.onconnectionstatechange = evt => {
        logger(`onconnectionstatechange->${_pc.connectionState}`);
    };
    _pc.onicecandidate = evt => {
        logger(`onicecandidate`);
        if (!evt.candidate) {
            answerSdpElem.value = _pc.localDescription.sdp;
            answerSdpElem.focus();
            answerSdpElem.select();
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
const onReceiveOffer = localStream => {
    logger(`onReceiveOffer`);
    pc = createPeerConnection(localStream);
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
(async () => {
    logger('start');
    let localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideoElem.srcObject = localStream;
    logger('set stream');

    receiveOfferButton.addEventListener('click', () => {
        onReceiveOffer(localStream);
    });
})();
