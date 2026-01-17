export function playBeep(frequency = 440, duration = 0.08, type = 'square') {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = playBeep.context || new AudioContext();
  playBeep.context = context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}
