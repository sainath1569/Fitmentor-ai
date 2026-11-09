import { useState } from 'react';
import media from '../lib/exerciseMedia.json';
import { Icon } from './Icon.jsx';

// Movement pattern for every exercise in server/src/knowledge/exercises.js, used to pick a fallback photo.
const PATTERN = {
  push: ['incline-pushup', 'pushup', 'decline-pushup', 'pike-pushup', 'band-press', 'db-floor-press', 'db-shoulder-press', 'bench-press', 'machine-press'],
  pull: ['towel-row', 'table-row', 'backpack-row', 'band-row', 'db-row', 'negative-pullup', 'pullup', 'lat-pulldown', 'cable-row'],
  squat: ['chair-squat', 'bodyweight-squat', 'split-squat', 'bulgarian-split', 'wall-sit', 'goblet-squat', 'barbell-squat', 'leg-press'],
  hinge: ['glute-bridge', 'single-leg-bridge', 'backpack-rdl', 'band-good-morning', 'db-rdl', 'deadlift', 'leg-curl'],
  core: ['plank', 'dead-bug', 'side-plank', 'hollow-hold', 'hanging-knee-raise'],
  cardio: ['stair-climb', 'march', 'shadow-box', 'jump-squat', 'burpee', 'skipping'],
};
const patternOf = (id) => Object.keys(PATTERN).find((p) => PATTERN[p].includes(id)) ?? 'push';

export function exerciseMedia(id, name) {
  const video = media.videos?.[id] ?? null;
  const photo = media.photos?.[patternOf(id)] ?? null;
  return {
    video,
    photo: photo?.file ?? '/images/training.jpg',
    photoCredit: photo?.credit,
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`,
  };
}

/** A verified form video when one exists; otherwise a reference photo for the movement pattern. */
export function ExerciseMedia({ id, name, playing, onPlay }) {
  const { video, photo } = exerciseMedia(id, name);
  const [thumbFailed, setThumbFailed] = useState(false);

  if (video && playing) {
    return (
      <div className="media">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
          title={`${name}: ${video.title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  if (video) {
    return (
      <div className="media">
        <img src={thumbFailed ? photo : `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" onError={() => setThumbFailed(true)} />
        {video.style === '3d' && <span className="media-tag media-3d">3D</span>}
        <button type="button" className="media-play" onClick={onPlay} aria-label={`Play form video for ${name}`}>
          <span><Icon name="play" size={18} /></span>
        </button>
      </div>
    );
  }
  return (
    <div className="media">
      <img src={photo} alt={`Reference photo for ${name}`} loading="lazy" />
      <span className="media-tag">Photo</span>
    </div>
  );
}
