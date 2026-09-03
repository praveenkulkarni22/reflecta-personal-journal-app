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
  private glockScale = [
    523.25, 587.33, 659.25, 783.99, 880.00, 
    1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00
  ];

  // Lush Warm Chords (Cmaj9, Am9, Fmaj7#11, G6/9, Em9, Dm9)
  private chords = [
    [130.81, 164.81, 196.00, 246.94, 329.63, 392.00], // Cmaj9 (C3, E3, G3, B3, E4, G4)
    [110.00, 146.83, 164.81, 220.00, 261.63, 329.63], // Am9 (A2, D3, E3, A3, C4, E4)
    [87.31, 130.81, 164.81, 246.94, 329.63, 392.00],  // Fmaj7#11 (F2, C3, E3, B3, E4, G4)
    [98.00, 146.83, 196.00, 246.94, 293.66, 392.00],  // G6/9 (G2, D3, G3, B3, D4, G4)
    [82.41, 123.47, 164.81, 196.00, 246.94, 329.63],  // Em9 (E2, B2, E3, G3, B3, E4)
    [73.42, 110.00, 146.83, 174.61, 220.00, 261.63],  // Dm9 (D2, A2, D3, F3, A3, C4)
  ];
  private currentChordIndex = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
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
    this.currentVolume = volume;
    this.playSanctuaryAmbience(volume);

    // If AudioContext was suspended due to browser policy, arm a 1-time listener
    if (!this.isAutoStartArmed && typeof window !== 'undefined') {
      this.isAutoStartArmed = true;
      const resumeHandler = () => {
        if (!this.isPlaying || (this.ctx && this.ctx.state === 'suspended')) {
          this.playSanctuaryAmbience(this.currentVolume || volume);
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

      if (this.isPlaying) {
        this.setVolume(volume);
        return;
      }

      this.currentVolume = volume;
      const now = this.ctx.currentTime;

      // 1. Master output bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 1.8);
      this.masterGain.connect(this.ctx.destination);

      // 2. Spatial Reverb / Diffusion Simulation Bus
      this.createSpatialReverbNetwork();

      // 3. Precision Sub-Buses (balanced organic mix)
      // Waves (34%): gentle foundation ebb and flow
      this.wavesGain = this.ctx.createGain();
      this.wavesGain.gain.setValueAtTime(0.34, now);
      this.wavesGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.wavesGain.connect(this.spatialReverbGain);

      // Warm Floating Pad (26%): harmonic glue
      this.padGain = this.ctx.createGain();
      this.padGain.gain.setValueAtTime(0.26, now);
      this.padGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.padGain.connect(this.spatialReverbGain);

      // Glockenspiel / Xylophone & Chimes (44%): clear metallic crystal tones
      this.glockenspielGain = this.ctx.createGain();
      this.glockenspielGain.gain.setValueAtTime(0.44, now);
      this.glockenspielGain.connect(this.masterGain);
      if (this.spatialReverbGain) this.glockenspielGain.connect(this.spatialReverbGain);

      // Forest Songbirds (30%): spatial lively accents
      this.birdsGain = this.ctx.createGain();
      this.birdsGain.gain.setValueAtTime(0.30, now);
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
      this.spatialReverbGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

      // Multi-tap stereo delay to simulate natural hall/sanctuary resonance
      const delayL = this.ctx.createDelay();
      const delayR = this.ctx.createDelay();
      delayL.delayTime.setValueAtTime(0.24, this.ctx.currentTime);
      delayR.delayTime.setValueAtTime(0.38, this.ctx.currentTime);

      const filterL = this.ctx.createBiquadFilter();
      const filterR = this.ctx.createBiquadFilter();
      filterL.type = 'lowpass';
      filterL.frequency.setValueAtTime(2200, this.ctx.currentTime);
      filterR.type = 'lowpass';
      filterR.frequency.setValueAtTime(1800, this.ctx.currentTime);

      const feedbackL = this.ctx.createGain();
      const feedbackR = this.ctx.createGain();
      feedbackL.gain.setValueAtTime(0.28, this.ctx.currentTime);
      feedbackR.gain.setValueAtTime(0.24, this.ctx.currentTime);

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
    } catch (e) {}
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
    this.wavesFilterL.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.wavesFilterL.Q.setValueAtTime(1.6, this.ctx.currentTime);

    this.wavesFilterR = this.ctx.createBiquadFilter();
    this.wavesFilterR.type = 'lowpass';
    this.wavesFilterR.frequency.setValueAtTime(360, this.ctx.currentTime);
    this.wavesFilterR.Q.setValueAtTime(1.4, this.ctx.currentTime);

    // Primary Wave LFO (~8.3s cycle)
    this.wavesLfo1 = this.ctx.createOscillator();
    this.wavesLfo1.type = 'sine';
    this.wavesLfo1.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const lfo1Gain = this.ctx.createGain();
    lfo1Gain.gain.setValueAtTime(280, this.ctx.currentTime);
    this.wavesLfo1.connect(lfo1Gain);
    lfo1Gain.connect(this.wavesFilterL.frequency);

    // Secondary Wave Swell LFO (~12.5s cycle)
    this.wavesLfo2 = this.ctx.createOscillator();
    this.wavesLfo2.type = 'sine';
    this.wavesLfo2.frequency.setValueAtTime(0.08, this.ctx.currentTime);
    const lfo2Gain = this.ctx.createGain();
    lfo2Gain.gain.setValueAtTime(240, this.ctx.currentTime);
    this.wavesLfo2.connect(lfo2Gain);
    lfo2Gain.connect(this.wavesFilterR.frequency);

    // Stereo Panning for Wide Natural Coastline
    const pannerL = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerL) pannerL.pan.setValueAtTime(-0.55, this.ctx.currentTime);
    const pannerR = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerR) pannerR.pan.setValueAtTime(0.55, this.ctx.currentTime);

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

    this.wavesLfo1.start();
    this.wavesLfo2.start();
    this.wavesSourceL.start();
    this.wavesSourceR.start();
  }

  // ---------------------------------------------------------------------------
  // 2. OVERLAPPING ETHEREAL HARMONIC PADS
  // ---------------------------------------------------------------------------
  private startOverlappingPads() {
    if (!this.ctx || !this.padGain) return;

    this.playNextPadChord();

    // Smooth overlapping progression every 8 seconds with generous 5-second cross-fade
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
    const frequencies = this.chords[this.currentChordIndex];

    // Smoothly fade out previous voice cluster
    const oldOscs = [...this.activePadOscillators];
    this.activePadOscillators = [];
    oldOscs.forEach((osc) => {
      try {
        osc.stop(now + 4.5);
      } catch (e) {}
    });

    // Spawn warm layered voices
    frequencies.forEach((freq, i) => {
      if (!this.ctx || !this.padGain) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      const detuneCents = (Math.random() - 0.5) * 5;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detuneCents, now);

      const voiceFilter = this.ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.frequency.setValueAtTime(450 + i * 90, now);

      const targetGain = 0.05 / (frequencies.length * 0.45);
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.exponentialRampToValueAtTime(targetGain, now + 3.2);
      oscGain.gain.exponentialRampToValueAtTime(targetGain * 0.8, now + 8.0);
      oscGain.gain.exponentialRampToValueAtTime(0.00001, now + 12.5);

      osc.connect(voiceFilter);
      voiceFilter.connect(oscGain);

      if (panner) {
        const pan = (i / (frequencies.length - 1)) * 1.2 - 0.6;
        panner.pan.setValueAtTime(pan, now);
        oscGain.connect(panner);
        panner.connect(this.padGain);
      } else {
        oscGain.connect(this.padGain);
      }

      osc.start(now);
      this.activePadOscillators.push(osc);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. POLYPHONIC GLOCKENSPIEL, XYLOPHONE & CRYSTAL CHIMES
  // ---------------------------------------------------------------------------
  /**
   * Runs concurrent, non-sequential musical voices:
   * - Voice 1: Flowing pentatonic melodic motifs (soft mallet strikes)
   * - Voice 2: Asynchronous crystal chime drops (sparkles on water)
   * - Voice 3: Periodic harmonic fifths/dyads
   */
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
   * Plays a flowing 3 to 5 note melodic phrase with natural dynamics
   */
  public playGlockenspielMelody() {
    if (!this.ctx || !this.glockenspielGain) return;

    const phraseLengths = [3, 4, 3, 5, 2];
    const phraseLen = phraseLengths[Math.floor(Math.random() * phraseLengths.length)];
    const startIndex = Math.floor(Math.random() * (this.glockScale.length - phraseLen));

    const notes: number[] = [];
    const roll = Math.random();

    if (roll < 0.4) {
      // Ascending
      for (let i = 0; i < phraseLen; i++) {
        notes.push(this.glockScale[startIndex + i]);
      }
    } else if (roll < 0.75) {
      // Arched (rise and fall)
      notes.push(this.glockScale[startIndex]);
      notes.push(this.glockScale[startIndex + 2]);
      notes.push(this.glockScale[startIndex + 3]);
      notes.push(this.glockScale[startIndex + 1]);
    } else {
      // Cascading descending
      for (let i = phraseLen - 1; i >= 0; i--) {
        notes.push(this.glockScale[startIndex + i]);
      }
    }

    const noteStep = 0.28 + Math.random() * 0.12;
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const strikeTime = now + idx * noteStep;
      // Slight velocity variation
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
    const note = highNotes[Math.floor(Math.random() * highNotes.length)];
    const now = this.ctx.currentTime;

    this.synthesizeStruckBar(note, now, 0.75);

    // 40% chance of a soft second echo sparkle
    if (Math.random() < 0.4) {
      const secondNote = highNotes[Math.floor(Math.random() * highNotes.length)];
      this.synthesizeStruckBar(secondNote, now + 0.18 + Math.random() * 0.1, 0.5);
    }
  }

  /**
   * Plays two complementary notes simultaneously (gentle harmony)
   */
  public playHarmonicDyad() {
    if (!this.ctx || !this.glockenspielGain) return;
    const rootNotes = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
    const root = rootNotes[Math.floor(Math.random() * rootNotes.length)];
    // Add third or fifth
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
    const t0 = strikeTime || this.ctx.currentTime;

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      const pan = (freq - 900) / 1400 * 0.7;
      panner.pan.setValueAtTime(Math.max(-0.75, Math.min(0.75, pan)), t0);
      panner.connect(this.glockenspielGain);
    }

    const destination = panner || this.glockenspielGain;

    // 1. Fundamental Bar Resonance (Sine Wave)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t0);

    const f0Gain = 0.15 * velocity;
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(f0Gain, t0 + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);

    osc1.connect(gain1);
    gain1.connect(destination);
    osc1.start(t0);
    osc1.stop(t0 + 3.0);

    // 2. 1st Inharmonic Overtone (2.756x Glockenspiel chime)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.756, t0);

    const f1Gain = 0.065 * velocity;
    gain2.gain.setValueAtTime(0.0001, t0);
    gain2.gain.linearRampToValueAtTime(f1Gain, t0 + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);

    osc2.connect(gain2);
    gain2.connect(destination);
    osc2.start(t0);
    osc2.stop(t0 + 0.8);

    // 3. 2nd Inharmonic Sparkle (5.404x)
    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 5.404, t0);

    const f2Gain = 0.024 * velocity;
    gain3.gain.setValueAtTime(0.0001, t0);
    gain3.gain.linearRampToValueAtTime(f2Gain, t0 + 0.002);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

    osc3.connect(gain3);
    gain3.connect(destination);
    osc3.start(t0);
    osc3.stop(t0 + 0.35);

    // 4. Mallet Strike Transient (wood/felt click)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(freq * 0.5, t0);
    clickGain.gain.setValueAtTime(0.06 * velocity, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);

    clickOsc.connect(clickGain);
    clickGain.connect(destination);
    clickOsc.start(t0);
    clickOsc.stop(t0 + 0.02);
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
  /**
   * Spatially distributes 2 independent bird voices across stereo channels
   * with organic overlapping Poisson timing (natural call-and-response)
   */
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
    const panPos = panPosition !== undefined ? panPosition : (Math.random() - 0.5) * 1.3;

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(panPos, phraseStartTime);
      panner.connect(this.birdsGain);
    }

    let chirpOffset = 0;

    for (let i = 0; i < numChirps; i++) {
      const chirpStart = phraseStartTime + chirpOffset;
      const chirpDuration = 0.07 + Math.random() * 0.08;
      const startF = baseFreq + (Math.random() - 0.5) * 500;
      const peakF = startF + 750 + Math.random() * 650;
      const endF = startF - 250 + (Math.random() - 0.5) * 350;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, chirpStart);
      osc.frequency.exponentialRampToValueAtTime(peakF, chirpStart + chirpDuration * 0.4);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1000, endF), chirpStart + chirpDuration);

      const chirpVol = 0.055 + Math.random() * 0.035;
      gain.gain.setValueAtTime(0.0001, chirpStart);
      gain.gain.exponentialRampToValueAtTime(chirpVol, chirpStart + chirpDuration * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, chirpStart + chirpDuration);

      osc.connect(gain);
      if (panner) {
        gain.connect(panner);
      } else {
        gain.connect(this.birdsGain);
      }

      osc.start(chirpStart);
      osc.stop(chirpStart + chirpDuration + 0.02);

      chirpOffset += chirpDuration + 0.05 + Math.random() * 0.07;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. TEARDOWN & VOLUME CONTROLS
  // ---------------------------------------------------------------------------
  public stopSanctuaryAmbience() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

      // Clear all active timers
      this.activeTimers.forEach((tid) => clearTimeout(tid));
      this.activeTimers = [];

      setTimeout(() => {
        if (this.wavesSourceL) {
          try {
            this.wavesSourceL.stop();
            this.wavesSourceL.disconnect();
          } catch (e) {}
          this.wavesSourceL = null;
        }
        if (this.wavesSourceR) {
          try {
            this.wavesSourceR.stop();
            this.wavesSourceR.disconnect();
          } catch (e) {}
          this.wavesSourceR = null;
        }
        if (this.wavesLfo1) {
          try {
            this.wavesLfo1.stop();
            this.wavesLfo1.disconnect();
          } catch (e) {}
          this.wavesLfo1 = null;
        }
        if (this.wavesLfo2) {
          try {
            this.wavesLfo2.stop();
            this.wavesLfo2.disconnect();
          } catch (e) {}
          this.wavesLfo2 = null;
        }
        this.activePadOscillators.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (e) {}
        });
        this.activePadOscillators = [];
        this.isPlaying = false;
        this.notify();
      }, 1100);
    } catch (e) {
      this.isPlaying = false;
      this.notify();
    }
  }

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0.0, Math.min(1.0, vol));
    if (this.masterGain && this.ctx && this.isPlaying) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, this.currentVolume),
        this.ctx.currentTime
      );
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
