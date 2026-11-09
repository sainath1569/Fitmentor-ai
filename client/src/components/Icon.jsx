import {
  ArrowClockwise, ArrowRight, ArrowSquareOut, Barbell, Camera, ChartLineUp, ChatCircleDots, Check, Clock, EnvelopeSimple,
  FileText, Fire, ForkKnife, House, Image, Leaf, Lightning, Play, Plus, Question, Scales, ShieldCheck, SignOut,
  Sparkle, Sun, Target, Trophy, UploadSimple, User, Wallet, X, Drop, CaretRight, CaretLeft,
} from '@phosphor-icons/react';

const ICONS = {
  arrow: ArrowRight, home: House, food: ForkKnife, training: Barbell, chart: ChartLineUp, chat: ChatCircleDots,
  camera: Camera, upload: UploadSimple, check: Check, close: X, spark: Sparkle, leaf: Leaf, clock: Clock, user: User,
  logout: SignOut, shield: ShieldCheck, weight: Scales, sun: Sun, file: FileText, retry: ArrowClockwise, play: Play,
  mail: EnvelopeSimple, help: Question, plus: Plus, external: ArrowSquareOut, photo: Image, wallet: Wallet, flame: Fire,
  bolt: Lightning, target: Target, trophy: Trophy, drop: Drop, next: CaretRight, prev: CaretLeft,
};

/** Phosphor icons behind one small API. `weight`: regular | bold | fill | duotone. */
export function Icon({ name = 'spark', size = 18, className = '', weight = 'bold', ...props }) {
  const C = ICONS[name] || Sparkle;
  return <C className={`icon ${className}`} size={size} weight={weight} aria-hidden="true" {...props} />;
}

/** The Health & Fitness emblem. Fills its container; `large` uses the full-resolution file. */
export function LogoMark({ large = false }) {
  return <img className="logo-img" src={large ? '/logo.jpg' : '/logo-icon.png'} alt="" draggable="false" />;
}

export function Brand() {
  return <span className="brand"><span className="brand-mark"><LogoMark /></span><span className="brand-word">FitMentor</span><span className="brand-ai">AI</span></span>;
}
