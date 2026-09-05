/**
 * Vibrant, Peaceful & Soothing Sanctuary Ambience Soundscape for Reflecta
 * 
 * Cohesive Polyphonic Mix:
 * 1. Continuous Organic Ocean Waves (dual asynchronous stereo wave swells)
 * 2. Warm Ethereal Ambient Foundation (harmonic major 9th & 11th floating pads with smooth overlapping crossfades)
 * 3. Polyphonic Glockenspiel / Xylophone & Crystal Chimes (interweaving melodic motifs, resonant sparkle drops & harmonic fifths)
 * 4. Spatial Forest Songbirds (multi-bird call-and-response with organic stereo placement)
 * 5. Spatial Reverb & Diffusion Network for a unified natural sanctuary acoustic space
 */

type SoundStateListener = (isPlaying: boolean, volume: number) => void;

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function safeParamSet(
  param: AudioParam | null | undefined,
  value: number,
  time: number,
  fallback = 0.0001
): void {
  if (!param) return;
  const safeVal = isFiniteNumber(value) ? value : fallback;
  const safeTime = isFiniteNumber(time) && time >= 0 ? time : 0;
  try {
    param.setValueAtTime(safeVal, safeTime);
  } catch {
    try {
      param.value = safeVal;
    } catch {}
  }
}

function safeParamExponentialRamp(
  param: AudioParam | null | undefined,
  value: number,
  time: number,
  fallback = 0.0001
): void {
  if (!param) return;
  // Web Audio specification requires exponential ramp target to be strictly positive (> 0)
  const safeVal = isFiniteNumber(value) && value > 0.00001 ? value : Math.max(0.0001, fallback);
  const safeTime = isFiniteNumber(time) && time >= 0 ? time : 0;
  try {
    param.exponentialRampToValueAtTime(safeVal, safeTime);
  } catch {
    try {
      param.linearRampToValueAtTime(safeVal, safeTime);
    } catch {}
  }
}

function safeParamLinearRamp(
  param: AudioParam | null | undefined,
  value: number,
  time: number,
  fallback = 0.0001
): void {
  if (!param) return;
  const safeVal = isFiniteNumber(value) ? value : fallback;
  const safeTime = isFiniteNumber(time) && time >= 0 ? time : 0;
  try {
    param.linearRampToValueAtTime(safeVal, safeTime);
  } catch {}
}

class SanctuaryAmbienceEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Sub-buses for precision mixing
  private wavesGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private glockenspielGain: GainNode | null = null;
  private birdsGain: GainNode | null = null;
  private spatialReverbGain: GainNode | null = null;

  // Sound sources & continuous nodes
  private wavesSourceL: AudioBufferSourceNode | null = null;
  private wavesSourceR: AudioBufferSourceNode | null = null;
  private wavesFilterL: BiquadFilterNode | null = null;
  private wavesFilterR: BiquadFilterNode | null = null;
  private wavesLfo1: OscillatorNode | null = null;
  private wavesLfo2: OscillatorNode | null = null;

  private isPlaying = false;
  private currentVolume = 0.30; // Default Peaceful Mode volume
  private isAutoStartArmed = false;
  
  // Generative active timers
  private activeTimers: number[] = [];
  private activePadOscillators: OscillatorNode[] = [];
  private listeners: Set<SoundStateListener> = new Set();

  // Pentatonic & Lydian Glockenspiel/Xylophone Scale (Hz)
  // C5, D5, E5, G5, A5, C6, D6, E6, G6, A6, C7
  private readonly glockScale = [
    523.25, 587.33, 659.25, 783.99, 880.00, 
    1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00
  ];

  // Lush Warm Chords (Cmaj9, Am9, Fmaj7#11, G6/9, Em9, Dm9)
  private readonly chords = [
    [130.81, 164.81, 196.00, 246.94, 329.63, 392.00], // Cmaj9 (C3, E3, G3, B3, E4, G4)
    [110.00, 146.83, 164.81, 220.00, 261.63, 329.63], // Am9 (A2, D3, E3, A3, C4, E4)
    [87.31, 130.81, 164.81, 246.94, 329.63, 392.00],  // Fmaj7#11 (F2, C3, E3, B3, E4, G4)
    [98.00, 146.83, 196.00, 246.94, 293.66, 392.00],  // G6/9 (G2, D3, G3, B3, D4, G4)
    [82.41, 123.47, 164.81, 196.00, 246.94, 329.63],  // Em9 (E2, B2, E3, G3, B3, E4)
    [73.42, 110.00, 146.83, 174.61, 220.00, 261.63],  // Dm9 (D2, A2, D3, F3, A3, C4)
  ];
  private currentChordIndex = 0;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public subscribe(listener: SoundStateListener) {
    this.listeners.add(listener);
    listener(this.isPlaying, this.currentVolume);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.isPlaying, this.currentVolume));
  }

  /**
   * Automatically activates Sanctuary Ambience in Peaceful Mode.
   * Handles browser autoplay policy by attempting immediate start and
   * falling back to instant activation on the first user interaction.
   */
  public autoStartPeacefulMode(volume = 0.30) {
    const safeVol = isFiniteNumber(volume) ? Math.max(0.0, Math.min(1.0, volume)) : 0.30;
    this.currentVolume = safeVol;
    this.playSanctuaryAmbience(safeVol);

    // If AudioContext was suspended due to browser policy, arm a 1-time listener
    if (!this.isAutoStartArmed && typeof window !== 'undefined') {
      this.isAutoStartArmed = true;
      const resumeHandler = () => {
        if (!this.isPlaying || (this.ctx && this.ctx.state === 'suspended')) {
          this.playSanctuaryAmbience(this.currentVolume || safeVol);
        }
      };

      const events = ['pointerdown', 'click', 'keydown', 'touchstart', 'scroll'];
      events.forEach((evt) => {
        window.addEventListener(evt, resumeHandler, { once: true, passive: true });
      });
    }
  }

  public playSanctuaryAmbience(volume = 0.30) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const safeVol = isFiniteNumber(volume) ? Math.max(0.0, Math.min(1.0, volume)) : 0.30;

      if (this.isPlaying) {
        this.setVolume(safeVol);
        return;
      }

      this.currentVolume = safeVol;
      const now = this.ctx.currentTime;

      // 1. Master output bus
      this.masterGain = this.ctx.createGain();
      safeParamSet(this.masterGain.gain, 0.0001, now);
      safeParamExponentialRamp(this.masterGain.gain, Math.max(0.0001, safeVol), now + 1.8);
      this.masterGain.connect(this.ctx.destination);

      // 2. Spatial Reverb / Diffusion Simulation Bus
      this.createSpatialReverbNetwork();

      // 3. Precision Sub-Buses (balanced organic mix)
      // Waves (34%): gentle foundation ebb and flow
      this.wavesGain = this.ctx.createGain();
      safeParamSet(this.wavesGain.gain, 0.34, now);
      this.wavesGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.wavesGain.connect(this.spatialReverbGain);

      // Warm Floating Pad (26%): harmonic glue
      this.padGain = this.ctx.createGain();
      safeParamSet(this.padGain.gain, 0.26, now);
      this.padGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.padGain.connect(this.spatialReverbGain);

      // Glockenspiel / Xylophone & Chimes (44%): clear metallic crystal tones
      this.glockenspielGain = this.ctx.createGain();
      safeParamSet(this.glockenspielGain.gain, 0.44, now);
      this.glockenspielGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.glockenspielGain.connect(this.spatialReverbGain);

      // Forest Songbirds (30%): spatial lively accents
      this.birdsGain = this.ctx.createGain();
      safeParamSet(this.birdsGain.gain, 0.30, now);
      this.birdsGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.birdsGain.connect(this.spatialReverbGain);

      // Start all continuous & overlapping layers simultaneously
      this.startContinuousOceanWaves();
      this.startOverlappingPads();
      this.startPolyphonicGlockenspielChimes();
      this.startSpatialBirdsong();

      this.isPlaying = true;
      this.notify();
    } catch (e) {
      console.warn('Sanctuary soundscape auto-activation deferred for user gesture:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 0. SPATIAL REVERB / DIFFUSION SIMULATION NETWORK
  // ---------------------------------------------------------------------------
  private createSpatialReverbNetwork() {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.spatialReverbGain = this.ctx.createGain();
      safeParamSet(this.spatialReverbGain.gain, 0.22, this.ctx.currentTime);

      // Multi-tap stereo delay to simulate natural hall/sanctuary resonance
      const delayL = this.ctx.createDelay();
      const delayR = this.ctx.createDelay();
      safeParamSet(delayL.delayTime, 0.24, this.ctx.currentTime);
      safeParamSet(delayR.delayTime, 0.38, this.ctx.currentTime);

      const filterL = this.ctx.createBiquadFilter();
      const filterR = this.ctx.createBiquadFilter();
      filterL.type = 'lowpass';
      safeParamSet(filterL.frequency, 2200, this.ctx.currentTime);
      filterR.type = 'lowpass';
      safeParamSet(filterR.frequency, 1800, this.ctx.currentTime);

      const feedbackL = this.ctx.createGain();
      const feedbackR = this.ctx.createGain();
      safeParamSet(feedbackL.gain, 0.28, this.ctx.currentTime);
      safeParamSet(feedbackR.gain, 0.24, this.ctx.currentTime);

      this.spatialReverbGain.connect(delayL);
      this.spatialReverbGain.connect(delayR);

      delayL.connect(filterL);
      delayR.connect(filterR);

      filterL.connect(feedbackL);
      feedbackL.connect(delayR); // Cross feedback

      filterR.connect(feedbackR);
      feedbackR.connect(delayL); // Cross feedback

      filterL.connect(this.masterGain);
      filterR.connect(this.masterGain);
    } catch (e) {
      console.warn('Spatial reverb setup note:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. CONTINUOUS ORGANIC DUAL-TIDE OCEAN WAVES
  // ---------------------------------------------------------------------------
  private startContinuousOceanWaves() {
    if (!this.ctx || !this.wavesGain) return;

    // Create 6-second stereo pink/brown noise buffers
    const bufferSize = 6 * this.ctx.sampleRate;
    const noiseBufferL = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const noiseBufferR = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outL = noiseBufferL.getChannelData(0);
    const outR = noiseBufferR.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      outL[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;

      // Subtle decorrelation for Right channel
      outR[i] = outL[i] * 0.85 + (Math.random() * 2 - 1) * 0.018;
    }

    this.wavesSourceL = this.ctx.createBufferSource();
    this.wavesSourceL.buffer = noiseBufferL;
    this.wavesSourceL.loop = true;

    this.wavesSourceR = this.ctx.createBufferSource();
    this.wavesSourceR.buffer = noiseBufferR;
    this.wavesSourceR.loop = true;

    // Dual resonant filters with dual distinct wave periods (8.5s primary wave + 11.2s secondary swell)
    this.wavesFilterL = this.ctx.createBiquadFilter();
    this.wavesFilterL.type = 'lowpass';
    safeParamSet(this.wavesFilterL.frequency, 320, this.ctx.currentTime);
    safeParamSet(this.wavesFilterL.Q, 1.6, this.ctx.currentTime);

    this.wavesFilterR = this.ctx.createBiquadFilter();
    this.wavesFilterR.type = 'lowpass';
    safeParamSet(this.wavesFilterR.frequency, 360, this.ctx.currentTime);
    safeParamSet(this.wavesFilterR.Q, 1.4, this.ctx.currentTime);

    // Primary Wave LFO (~8.3s cycle)
    this.wavesLfo1 = this.ctx.createOscillator();
    this.wavesLfo1.type = 'sine';
    safeParamSet(this.wavesLfo1.frequency, 0.12, this.ctx.currentTime);
    const lfo1Gain = this.ctx.createGain();
    safeParamSet(lfo1Gain.gain, 280, this.ctx.currentTime);
    this.wavesLfo1.connect(lfo1Gain);
    lfo1Gain.connect(this.wavesFilterL.frequency);

    // Secondary Wave Swell LFO (~12.5s cycle)
    this.wavesLfo2 = this.ctx.createOscillator();
    this.wavesLfo2.type = 'sine';
    safeParamSet(this.wavesLfo2.frequency, 0.08, this.ctx.currentTime);
    const lfo2Gain = this.ctx.createGain();
    safeParamSet(lfo2Gain.gain, 240, this.ctx.currentTime);
    this.wavesLfo2.connect(lfo2Gain);
    lfo2Gain.connect(this.wavesFilterR.frequency);

    // Stereo Panning for Wide Natural Coastline
    const pannerL = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerL) safeParamSet(pannerL.pan, -0.55, this.ctx.currentTime);
    const pannerR = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerR) safeParamSet(pannerR.pan, 0.55, this.ctx.currentTime);

    this.wavesSourceL.connect(this.wavesFilterL);
    if (pannerL) {
      this.wavesFilterL.connect(pannerL);
      pannerL.connect(this.wavesGain);
    } else {
      this.wavesFilterL.connect(this.wavesGain);
    }

    this.wavesSourceR.connect(this.wavesFilterR);
    if (pannerR) {
      this.wavesFilterR.connect(pannerR);
      pannerR.connect(this.wavesGain);
    } else {
      this.wavesFilterR.connect(this.wavesGain);
    }

    try {
      this.wavesLfo1.start();
      this.wavesLfo2.start();
      this.wavesSourceL.start();
      this.wavesSourceR.start();
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // 2. OVERLAPPING ETHEREAL HARMONIC PADS
  // ---------------------------------------------------------------------------
  private startOverlappingPads() {
    if (!this.ctx || !this.padGain) return;

    this.playNextPadChord();

    // Smooth overlapping progression every 8.5 seconds with generous cross-fade
    const chordInterval = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
      this.playNextPadChord();
    }, 8500);
    this.activeTimers.push(chordInterval);
  }

  private playNextPadChord() {
    if (!this.ctx || !this.padGain) return;
    const now = this.ctx.currentTime;
    const rawChord = this.chords[this.currentChordIndex] || this.chords[0];
    const frequencies = Array.isArray(rawChord) ? rawChord : this.chords[0];

    // Smoothly fade out previous voice cluster
    const oldOscs = [...this.activePadOscillators];
    this.activePadOscillators = [];
    oldOscs.forEach((osc) => {
      try {
        osc.stop(now + 4.5);
      } catch {}
    });

    // Spawn warm layered voices
    frequencies.forEach((freq, i) => {
      if (!this.ctx || !this.padGain) return;
      if (!isFiniteNumber(freq) || freq <= 0) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      const detuneCents = (Math.random() - 0.5) * 5;
      safeParamSet(osc.frequency, freq, now, 220);
      safeParamSet(osc.detune, detuneCents, now, 0);

      const voiceFilter = this.ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      safeParamSet(voiceFilter.frequency, 450 + i * 90, now, 500);

      const targetGain = 0.05 / Math.max(1, frequencies.length * 0.45);
      safeParamSet(oscGain.gain, 0.0001, now);
      safeParamExponentialRamp(oscGain.gain, targetGain, now + 3.2);
      safeParamExponentialRamp(oscGain.gain, targetGain * 0.8, now + 8.0);
      safeParamExponentialRamp(oscGain.gain, 0.00001, now + 12.5);

      osc.connect(voiceFilter);
      voiceFilter.connect(oscGain);

      if (panner) {
        const denom = Math.max(1, frequencies.length - 1);
        const pan = (i / denom) * 1.2 - 0.6;
        const safePan = isFiniteNumber(pan) ? Math.max(-0.9, Math.min(0.9, pan)) : 0;
        safeParamSet(panner.pan, safePan, now, 0);
        oscGain.connect(panner);
        panner.connect(this.padGain);
      } else {
        oscGain.connect(this.padGain);
      }

      try {
        osc.start(now);
      } catch {}
      this.activePadOscillators.push(osc);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. POLYPHONIC GLOCKENSPIEL, XYLOPHONE & CRYSTAL CHIMES
  // ---------------------------------------------------------------------------
  private startPolyphonicGlockenspielChimes() {
    // 1. Melodic Phrase Voice (every 4.5s - 7.5s)
    const scheduleNextMelody = () => {
      if (!this.isPlaying) return;
      this.playGlockenspielMelody();
      const delay = 4200 + Math.random() * 3200;
      const tid = window.setTimeout(scheduleNextMelody, delay);
      this.activeTimers.push(tid);
    };

    // 2. Crystal Chime Drops Voice (every 2.2s - 4.8s, overlapping asynchronously)
    const scheduleNextChimeDrop = () => {
      if (!this.isPlaying) return;
      this.playCrystallineSparkleDrop();
      const delay = 2200 + Math.random() * 2600;
      const tid = window.setTimeout(scheduleNextChimeDrop, delay);
      this.activeTimers.push(tid);
    };

    // 3. Harmonic Dyad Voice (every 6.0s - 10.0s)
    const scheduleNextHarmonicDyad = () => {
      if (!this.isPlaying) return;
      this.playHarmonicDyad();
      const delay = 6000 + Math.random() * 4000;
      const tid = window.setTimeout(scheduleNextHarmonicDyad, delay);
      this.activeTimers.push(tid);
    };

    const t1 = window.setTimeout(scheduleNextMelody, 800);
    const t2 = window.setTimeout(scheduleNextChimeDrop, 2200);
    const t3 = window.setTimeout(scheduleNextHarmonicDyad, 4500);
    this.activeTimers.push(t1, t2, t3);
  }

  /**
   * Plays a flowing 3 to 5 note melodic phrase with natural dynamics.
   * All indices are strictly bounded to prevent out-of-bounds undefined reads.
   */
  public playGlockenspielMelody() {
    if (!this.ctx || !this.glockenspielGain) return;

    const scaleLen = this.glockScale.length;
    if (scaleLen === 0) return;

    const phraseLengths = [3, 4, 3, 5, 2];
    const phraseLen = Math.min(scaleLen, phraseLengths[Math.floor(Math.random() * phraseLengths.length)] || 3);
    const maxStart = Math.max(0, scaleLen - phraseLen);
    const startIndex = Math.min(maxStart, Math.floor(Math.random() * (maxStart + 1)));

    const notes: number[] = [];
    const roll = Math.random();

    if (roll < 0.4) {
      // Ascending
      for (let i = 0; i < phraseLen; i++) {
        const idx = Math.min(scaleLen - 1, startIndex + i);
        notes.push(this.glockScale[idx]);
      }
    } else if (roll < 0.75) {
      // Arched (rise and fall) with bounds-clamped indexing
      const i1 = Math.min(scaleLen - 1, startIndex);
      const i2 = Math.min(scaleLen - 1, startIndex + 2);
      const i3 = Math.min(scaleLen - 1, startIndex + 3);
      const i4 = Math.min(scaleLen - 1, startIndex + 1);
      notes.push(this.glockScale[i1], this.glockScale[i2], this.glockScale[i3], this.glockScale[i4]);
    } else {
      // Cascading descending
      for (let i = phraseLen - 1; i >= 0; i--) {
        const idx = Math.min(scaleLen - 1, startIndex + i);
        notes.push(this.glockScale[idx]);
      }
    }

    const noteStep = 0.28 + Math.random() * 0.12;
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!isFiniteNumber(freq) || freq <= 0) return;
      const strikeTime = now + idx * noteStep;
      const velocity = 0.85 + Math.random() * 0.3;
      this.synthesizeStruckBar(freq, strikeTime, velocity);
    });
  }

  /**
   * Plays single/double high crystalline bell drops that sparkle organically
   */
  public playCrystallineSparkleDrop() {
    if (!this.ctx || !this.glockenspielGain) return;
    const highNotes = [1046.50, 1318.51, 1567.98, 1760.00, 2093.00]; // C6, E6, G6, A6, C7
    const note = highNotes[Math.floor(Math.random() * highNotes.length)] || 1046.50;
    const now = this.ctx.currentTime;

    this.synthesizeStruckBar(note, now, 0.75);

    // 40% chance of a soft second echo sparkle
    if (Math.random() < 0.4) {
      const secondNote = highNotes[Math.floor(Math.random() * highNotes.length)] || 1318.51;
      this.synthesizeStruckBar(secondNote, now + 0.18 + Math.random() * 0.1, 0.5);
    }
  }

  /**
   * Plays two complementary notes simultaneously (gentle harmony)
   */
  public playHarmonicDyad() {
    if (!this.ctx || !this.glockenspielGain) return;
    const rootNotes = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
    const root = rootNotes[Math.floor(Math.random() * rootNotes.length)] || 523.25;
    const fifth = root * 1.5;
    const now = this.ctx.currentTime;

    this.synthesizeStruckBar(root, now, 0.8);
    this.synthesizeStruckBar(fifth, now + 0.015, 0.7); // Micro flam offset
  }

  /**
   * Synthesizes an authentic metallic struck bar (Glockenspiel/Xylophone):
   * - Fundamental tone f0 (long resonant ring)
   * - Inharmonic metallic overtone 1 ~ 2.756 * f0 (bell chime)
   * - Inharmonic metallic overtone 2 ~ 5.404 * f0 (sparkle shimmer)
   * - Soft mallet transient click (felt/wood strike)
   */
  public synthesizeStruckBar(freq: number, strikeTime?: number, velocity = 1.0) {
    if (!this.ctx || !this.glockenspielGain) return;
    if (!isFiniteNumber(freq) || freq <= 20) return;

    const now = this.ctx.currentTime;
    const t0 = isFiniteNumber(strikeTime) && strikeTime >= now ? strikeTime : now;
    const vel = isFiniteNumber(velocity) && velocity > 0 ? velocity : 1.0;

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      const rawPan = ((freq - 900) / 1400) * 0.7;
      const pan = isFiniteNumber(rawPan) ? Math.max(-0.75, Math.min(0.75, rawPan)) : 0;
      safeParamSet(panner.pan, pan, t0, 0);
      panner.connect(this.glockenspielGain);
    }

    const destination = panner || this.glockenspielGain;

    // 1. Fundamental Bar Resonance (Sine Wave)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    safeParamSet(osc1.frequency, freq, t0, 440);

    const f0Gain = 0.15 * vel;
    safeParamSet(gain1.gain, 0.0001, t0);
    safeParamLinearRamp(gain1.gain, f0Gain, t0 + 0.004);
    safeParamExponentialRamp(gain1.gain, 0.0001, t0 + 2.8);

    osc1.connect(gain1);
    gain1.connect(destination);
    try {
      osc1.start(t0);
      osc1.stop(t0 + 3.0);
    } catch {}

    // 2. 1st Inharmonic Overtone (2.756x Glockenspiel chime)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    safeParamSet(osc2.frequency, freq * 2.756, t0, 1200);

    const f1Gain = 0.065 * vel;
    safeParamSet(gain2.gain, 0.0001, t0);
    safeParamLinearRamp(gain2.gain, f1Gain, t0 + 0.003);
    safeParamExponentialRamp(gain2.gain, 0.0001, t0 + 0.7);

    osc2.connect(gain2);
    gain2.connect(destination);
    try {
      osc2.start(t0);
      osc2.stop(t0 + 0.8);
    } catch {}

    // 3. 2nd Inharmonic Sparkle (5.404x)
    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'sine';
    safeParamSet(osc3.frequency, freq * 5.404, t0, 2400);

    const f2Gain = 0.024 * vel;
    safeParamSet(gain3.gain, 0.0001, t0);
    safeParamLinearRamp(gain3.gain, f2Gain, t0 + 0.002);
    safeParamExponentialRamp(gain3.gain, 0.0001, t0 + 0.28);

    osc3.connect(gain3);
    gain3.connect(destination);
    try {
      osc3.start(t0);
      osc3.stop(t0 + 0.35);
    } catch {}

    // 4. Mallet Strike Transient (wood/felt click)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    safeParamSet(clickOsc.frequency, freq * 0.5, t0, 220);
    safeParamSet(clickGain.gain, 0.06 * vel, t0, 0.06);
    safeParamExponentialRamp(clickGain.gain, 0.0001, t0 + 0.012);

    clickOsc.connect(clickGain);
    clickGain.connect(destination);
    try {
      clickOsc.start(t0);
      clickOsc.stop(t0 + 0.02);
    } catch {}
  }

  // Chime trigger helper for UI feedback
  public playGlockenspielChime() {
    this.initContext();
    if (!this.ctx) return;
    this.synthesizeStruckBar(1046.50); // C6
    setTimeout(() => {
      this.synthesizeStruckBar(1318.51); // E6
    }, 160);
    setTimeout(() => {
      this.synthesizeStruckBar(1567.98); // G6
    }, 320);
  }

  public playGentleChime() {
    this.playGlockenspielChime();
  }

  // ---------------------------------------------------------------------------
  // 4. SPATIAL MULTI-BIRD FOREST ENSEMBLE (Call & Response)
  // ---------------------------------------------------------------------------
  private startSpatialBirdsong() {
    // Bird 1 (Near-Left & Center, sweet fast trills)
    const scheduleBird1 = () => {
      if (!this.isPlaying) return;
      this.synthesizeBirdPhrase(-0.55);
      const delay = 3200 + Math.random() * 3800;
      const tid = window.setTimeout(scheduleBird1, delay);
      this.activeTimers.push(tid);
    };

    // Bird 2 (Right channel answering warble, slightly higher pitch)
    const scheduleBird2 = () => {
      if (!this.isPlaying) return;
      this.synthesizeBirdPhrase(0.60);
      const delay = 4500 + Math.random() * 4200;
      const tid = window.setTimeout(scheduleBird2, delay);
      this.activeTimers.push(tid);
    };

    const b1 = window.setTimeout(scheduleBird1, 1200);
    const b2 = window.setTimeout(scheduleBird2, 2800);
    this.activeTimers.push(b1, b2);
  }

  public synthesizeBirdPhrase(panPosition?: number) {
    if (!this.ctx || !this.birdsGain) return;

    const numChirps = 2 + Math.floor(Math.random() * 3); // 2 to 4 micro chirps
    const baseFreq = 2900 + Math.random() * 1500;
    const phraseStartTime = this.ctx.currentTime + 0.05;
    const rawPan = isFiniteNumber(panPosition) ? panPosition : (Math.random() - 0.5) * 1.3;
    const panPos = Math.max(-0.95, Math.min(0.95, rawPan));

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      safeParamSet(panner.pan, panPos, phraseStartTime, 0);
      panner.connect(this.birdsGain);
    }

    let chirpOffset = 0;

    for (let i = 0; i < numChirps; i++) {
      const chirpStart = phraseStartTime + chirpOffset;
      const chirpDuration = 0.07 + Math.random() * 0.08;
      const startF = baseFreq + (Math.random() - 0.5) * 500;
      const peakF = startF + 750 + Math.random() * 650;
      const endF = Math.max(1000, startF - 250 + (Math.random() - 0.5) * 350);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      safeParamSet(osc.frequency, startF, chirpStart, 3000);
      safeParamExponentialRamp(osc.frequency, peakF, chirpStart + chirpDuration * 0.4, 3500);
      safeParamExponentialRamp(osc.frequency, endF, chirpStart + chirpDuration, 2800);

      const chirpVol = 0.055 + Math.random() * 0.035;
      safeParamSet(gain.gain, 0.0001, chirpStart);
      safeParamExponentialRamp(gain.gain, chirpVol, chirpStart + chirpDuration * 0.25, 0.05);
      safeParamExponentialRamp(gain.gain, 0.0001, chirpStart + chirpDuration);

      osc.connect(gain);
      if (panner) {
        gain.connect(panner);
      } else {
        gain.connect(this.birdsGain);
      }

      try {
        osc.start(chirpStart);
        osc.stop(chirpStart + chirpDuration + 0.02);
      } catch {}

      chirpOffset += chirpDuration + 0.05 + Math.random() * 0.07;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. TACTILE NOTEBOOK PAGE FLIP SOUND EFFECT
  // ---------------------------------------------------------------------------
  public playPageFlipSound() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      const duration = 0.18;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Soft pink-ish filtered random noise
        output[i] = (Math.random() * 2 - 1) * 0.4;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      safeParamSet(filter.frequency, 1600, now);
      safeParamExponentialRamp(filter.frequency, 750, now + duration);
      safeParamSet(filter.Q, 1.4, now);

      const gainNode = this.ctx.createGain();
      safeParamSet(gainNode.gain, 0.0001, now);
      safeParamLinearRamp(gainNode.gain, 0.09, now + 0.03);
      safeParamExponentialRamp(gainNode.gain, 0.0001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + duration + 0.02);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // ---------------------------------------------------------------------------
  // 6. TEARDOWN & VOLUME CONTROLS
  // ---------------------------------------------------------------------------
  public stopSanctuaryAmbience() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
      } catch {}

      const currentGain = (isFiniteNumber(this.masterGain.gain.value) && this.masterGain.gain.value > 0.0001)
        ? this.masterGain.gain.value
        : Math.max(0.0001, this.currentVolume);

      safeParamSet(this.masterGain.gain, currentGain, now, 0.3);
      safeParamExponentialRamp(this.masterGain.gain, 0.0001, now + 0.8);

      // Clear all active timers
      this.activeTimers.forEach((tid) => clearTimeout(tid));
      this.activeTimers = [];

      setTimeout(() => {
        if (this.wavesSourceL) {
          try {
            this.wavesSourceL.stop();
            this.wavesSourceL.disconnect();
          } catch {}
          this.wavesSourceL = null;
        }
        if (this.wavesSourceR) {
          try {
            this.wavesSourceR.stop();
            this.wavesSourceR.disconnect();
          } catch {}
          this.wavesSourceR = null;
        }
        if (this.wavesLfo1) {
          try {
            this.wavesLfo1.stop();
            this.wavesLfo1.disconnect();
          } catch {}
          this.wavesLfo1 = null;
        }
        if (this.wavesLfo2) {
          try {
            this.wavesLfo2.stop();
            this.wavesLfo2.disconnect();
          } catch {}
          this.wavesLfo2 = null;
        }
        this.activePadOscillators.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        });
        this.activePadOscillators = [];
        this.isPlaying = false;
        this.notify();
      }, 900);
    } catch {
      this.isPlaying = false;
      this.notify();
    }
  }

  public setVolume(vol: number) {
    const safeVol = isFiniteNumber(vol) ? Math.max(0.0, Math.min(1.0, vol)) : 0.30;
    this.currentVolume = safeVol;
    if (this.masterGain && this.ctx && this.isPlaying) {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        safeParamSet(
          this.masterGain.gain,
          Math.max(0.0001, this.currentVolume),
          now,
          0.30
        );
      } catch (e) {
        console.warn('Volume set note:', e);
      }
    }
    this.notify();
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public getActive(): boolean {
    return this.isPlaying;
  }
}

export const ambientSound = new SanctuaryAmbienceEngine();
