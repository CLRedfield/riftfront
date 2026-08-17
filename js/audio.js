(function () {
  'use strict';

  const RF = window.RF = window.RF || {};

  class AudioManager {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
      this.lastHitAt = 0;
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      if (this.master) this.master.gain.value = this.enabled ? 0.16 : 0;
    }

    ensureContext() {
      if (!this.enabled) return null;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.context) {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    }

    tone(freq, duration, options = {}) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = options.type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (options.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), now + duration);

      filter.type = options.filterType || 'lowpass';
      filter.frequency.value = options.filter || 2200;

      const volume = options.volume ?? 0.7;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.02, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    chord(frequencies, duration, options = {}) {
      frequencies.forEach((freq, index) => {
        setTimeout(() => this.tone(freq, duration, options), index * (options.stagger || 0));
      });
    }

    noise(duration = 0.15, volume = 0.25) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start();
    }

    play(name) {
      if (!this.enabled) return;
      switch (name) {
        case 'click': this.tone(420, 0.055, { type: 'triangle', volume: 0.35, endFreq: 520 }); break;
        case 'select': this.tone(620, 0.07, { type: 'sine', volume: 0.28, endFreq: 720 }); break;
        case 'card': this.chord([260, 390], 0.11, { type: 'triangle', volume: 0.34, stagger: 18 }); break;
        case 'draw': this.tone(760, 0.075, { type: 'sine', volume: 0.2, endFreq: 960 }); break;
        case 'archive': this.tone(440, 0.12, { type: 'triangle', volume: 0.24, endFreq: 230 }); break;
        case 'hit': {
          const now = performance.now();
          if (now - this.lastHitAt < 80) return;
          this.lastHitAt = now;
          this.tone(150 + Math.random() * 80, 0.055, { type: 'square', volume: 0.12, endFreq: 90 });
          break;
        }
        case 'boom': this.noise(0.24, 0.34); this.tone(95, 0.24, { type: 'sawtooth', volume: 0.32, endFreq: 42, filter: 520 }); break;
        case 'freeze': this.chord([880, 1180, 1480], 0.18, { type: 'sine', volume: 0.12, stagger: 25 }); break;
        case 'stage': this.chord([220, 330, 495], 0.34, { type: 'sawtooth', volume: 0.25, stagger: 55, filter: 1500 }); break;
        case 'warning': this.chord([180, 180], 0.12, { type: 'square', volume: 0.2, stagger: 170, filter: 700 }); break;
        case 'victory': this.chord([261.6, 329.6, 392, 523.2], 0.46, { type: 'triangle', volume: 0.34, stagger: 85 }); break;
        case 'defeat': this.chord([220, 185, 146], 0.5, { type: 'sawtooth', volume: 0.22, stagger: 130, filter: 900 }); break;
        default: break;
      }
    }
  }

  RF.audio = new AudioManager();
})();
