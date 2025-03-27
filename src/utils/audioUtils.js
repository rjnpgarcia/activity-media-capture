export const createWavFile = (audioData) => {
    const { sampleRate, channels } = this.state;
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + audioData.length * 2, true);
    this.writeString(view, 8, "WAVE");
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, "data");
    view.setUint32(40, audioData.length * 2, true);

    // Write audio data
    for (let i = 0; i < audioData.length; i++) {
        view.setInt16(44 + i * 2, audioData[i], true);
    }

    return buffer;
};

export const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

export const concatenateAudioChunks = (audioChunks = []) => {
    const totalLength = audioChunks.reduce(
        (acc, chunk) => acc + chunk.length,
        0
    );
    const result = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
};
